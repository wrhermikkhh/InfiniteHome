import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { changeInventory, inventorySale, inventoryOrderStatus, inventoryPosUpdate, restoreAllocations } from "../shared/inventory";
import { inventoryProductEdit, prepareInventoryEdit, protectAllocationStructure, validateHistoricalAllocations, reconcileHistoricalInventory } from "../shared/inventory-admin";
import { registerInventoryAdmin } from "../shared/inventory-routes";
import { calculateCatalogQuote, createCatalogOrder } from "../shared/checkout";
import { readFileSync } from "node:fs";

test("legacy ledger comparisons normalize order and UUID POS identifiers to text", () => {
  const source = readFileSync("shared/inventory-admin.ts", "utf8");
  assert.match(source, /SELECT o\.id::text AS id FROM orders/);
  assert.match(source, /UNION ALL SELECT p\.id::text AS id FROM pos_transactions/);
  assert.match(source, /s\.owner_id = o\.id::text/);
  assert.match(source, /s\.owner_id = p\.id::text/);
});

// Deterministic transaction adapter. No DB connection, provider, email, or env.
// A write requires a preceding FOR UPDATE; waiting transactions see committed
// data. Rollback restores the snapshot taken after acquiring the lock.
class FakeDb {
  products: Record<string, any>;
  sales: Record<string, any> = {};
  orders: Record<string, any> = {};
  pos: Record<string, any> = {};
  coupons: Record<string, any> = {};
  tail: Promise<void> = Promise.resolve();
  dialect = new PgDialect();
  constructor(readonly pgShape: boolean, products: any[]) {
    this.products = Object.fromEntries(products.map(p => [p.id, structuredClone(p)]));
  }
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    let unlock: (() => void) | undefined;
    let snapshot: any;
    const lock = async () => {
      if (unlock) return;
      const prior = this.tail;
      this.tail = new Promise<void>(r => { unlock = r; });
      await prior;
      snapshot = structuredClone({ products: this.products, sales: this.sales, orders: this.orders, pos: this.pos });
    };
    const tx = {
      execute: async (query: any) => {
        const { sql, params: p } = this.dialect.sqlToQuery(query);
        if (sql.includes("FOR UPDATE")) await lock();
        assert.ok(unlock, "all inventory access must lock first");
        let result: any[] = [];
        if (sql.startsWith("SELECT * FROM products")) result = this.products[p[0]] ? [structuredClone(this.products[p[0]])] : [];
        else if (sql.startsWith("SELECT * FROM coupons")) {
          assert.ok(sql.includes("FOR SHARE"), "coupon must remain stable until checkout commits");
          result = this.coupons[p[0]] ? [structuredClone(this.coupons[p[0]])] : [];
        }
        else if (sql.startsWith("UPDATE products")) {
          const field = sql.match(/SET "([^"]+)"/)?.[1];
          if (field) this.products[p[1]][field] = sql.includes("::jsonb") ? JSON.parse(p[0]) : p[0];
          else this.products[p[4]] = { ...this.products[p[4]], stock: p[0], variant_stock: JSON.parse(p[1]), pre_order_stock: p[2], pre_order_variant_stock: JSON.parse(p[3]) };
        } else if (sql.startsWith("INSERT INTO legacy_inventory_reservations")) {
          const key = `${p[0]}:${p[1]}`;
          assert.ok(!this.sales[key], "unique ledger");
          this.sales[key] = { owner_type: p[0], owner_id: p[1], allocations: JSON.parse(p[2]), restored_at: null,
            ...(p.length > 3 ? { reconciled_by: p[3], reconciliation_note: p[4] } : {}) };
        } else if (sql.startsWith("SELECT * FROM legacy_inventory_reservations")) {
          const key = p.length === 2 ? `${p[0]}:${p[1]}` : `${sql.includes("'pos'") ? "pos" : "order"}:${p[0]}`;
          result = this.sales[key] ? [structuredClone(this.sales[key])] : [];
        } else if (sql.startsWith("SELECT a.value AS allocation FROM legacy_inventory_reservations")) {
          result = Object.values(this.sales).filter(s => !s.restored_at).flatMap(s => s.allocations)
            .filter(a => a.productId === p[0]).map(a => ({ allocation: structuredClone(a) }));
        } else if (
          sql.includes("to_regclass('public.inventory_batches')")
          && sql.includes("to_regclass('public.sale_cogs_lines')")
        ) {
          // The additive cost ledger is intentionally absent from this
          // legacy-inventory fake database. Keep the query explicit so other
          // unexpected SQL still fails below.
          result = [{ batches: null, cogs: null }];
        } else if (sql.startsWith("SELECT to_regclass")) {
          result = [{ relation: null }];
        } else if (sql.startsWith("SELECT id FROM orders")) {
          result = [];
        } else if (sql.startsWith("UPDATE legacy_inventory_reservations SET owner_type")) {
          const source = this.sales[`pos:${p[1]}`];
          if (source && !source.restored_at) {
            this.sales[`order:${p[0]}`] = { ...source, owner_type: "order", owner_id: p[0] };
            delete this.sales[`pos:${p[1]}`];
            result = [{ owner_id: p[0] }];
          }
        } else if (sql.startsWith("UPDATE legacy_inventory_reservations")) {
          this.sales[`${p[0]}:${p[1]}`].restored_at = "restored";
        } else if (sql.startsWith("SELECT * FROM orders")) result = this.orders[p[0]] ? [structuredClone(this.orders[p[0]])] : [];
        else if (sql.startsWith("SELECT * FROM pos_transactions")) result = this.pos[p[0]] ? [structuredClone(this.pos[p[0]])] : [];
        else if (sql.startsWith("UPDATE pos_transactions")) this.pos[p[1]].converted_to_order_id = p[0];
        else throw new Error(`Unexpected test query: ${sql}`);
        await Promise.resolve(); // force interleaving at every database operation
        return this.pgShape ? { rows: result } : result;
      },
    };
    try { return await fn(tx); }
    catch (e) { if (snapshot) Object.assign(this, snapshot); throw e; }
    finally { unlock?.(); }
  }
}
const product = (id = "p", extra = {}) => ({ id, stock: 5, variant_stock: {}, pre_order_stock: null, pre_order_variant_stock: {}, is_pre_order: true, ...extra });
const item = (qty = 1, extra = {}) => ({ productId: "p", qty, size: "Standard", color: "Default", ...extra });
for (const pgShape of [false, true]) {
  const label = pgShape ? "pg" : "postgres-js";
  test(`${label}: concurrent sales cannot oversell, insertion failure rolls back`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    const outcomes = await Promise.allSettled(["a", "b"].map(id =>
      inventorySale(db, [item(4)], "order", async () => ({ id }))));
    assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(db.products.p.stock, 1);
    await assert.rejects(inventorySale(db, [item()], "pos", async () => { throw new Error("insert failed"); }), /insert failed/);
    assert.equal(db.products.p.stock, 1);
  });
  test(`${label}: aliases aggregate under lock and mixed basket failure rolls back`, async () => {
    const db = new FakeDb(pgShape, [product("p", { variant_stock: { "M-Red": 3 } }), product("q", { stock: 0 })]);
    await assert.rejects(inventorySale(db, [item(2, { size: "M", color: "Red" }), item(2, { size: "m", color: "red" })], "order", async () => ({ id: "a" })), /Stock/);
    assert.equal(db.products.p.variant_stock["M-Red"], 3);
    await assert.rejects(inventorySale(db, [item(1, { size: "M", color: "Red" }), item(1, { productId: "q" })], "order", async () => ({ id: "a" })), /Stock/);
    assert.equal(db.products.p.variant_stock["M-Red"], 3);
  });
  test(`${label}: preorder total + variant caps, missing variant and unlimited caps`, async () => {
    const db = new FakeDb(pgShape, [product("p", { pre_order_stock: 2, pre_order_variant_stock: { "Standard-Default": 5 } })]);
    await assert.rejects(db.transaction(tx => changeInventory(tx, [item(2, { isPreOrder: true }), item(1, { isPreOrder: true })])), /Stock/);
    await assert.rejects(db.transaction(tx => changeInventory(tx, [item(1, { isPreOrder: true, size: "M" })])), /variant/);
    const allocations = await db.transaction(tx => changeInventory(tx, [item(2, { isPreOrder: true })]));
    assert.equal(db.products.p.pre_order_stock, 0);
    assert.equal(db.products.p.pre_order_variant_stock["Standard-Default"], 3);
    await db.transaction(tx => restoreAllocations(tx, allocations));
    assert.equal(db.products.p.pre_order_stock, 2);
    const unlimited = new FakeDb(pgShape, [product()]);
    await unlimited.transaction(tx => changeInventory(tx, [item(100, { isPreOrder: true })]));
    assert.equal(unlimited.products.p.pre_order_stock, null);
  });
  test(`${label}: concurrent cancellation restores once and cannot reopen`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    db.orders.a = { id: "a", status: "pending", payment_method: "bank" };
    await inventorySale(db, [item(3)], "order", async () => db.orders.a);
    const cancel = () => inventoryOrderStatus(db, "a", "cancelled", async () => {
      db.orders.a.status = "cancelled"; return db.orders.a;
    });
    await Promise.all([cancel(), cancel(), cancel()]);
    assert.equal(db.products.p.stock, 5);
    await assert.rejects(inventoryOrderStatus(db, "a", "pending", async () => null), /reopened/);
  });
  test(`${label}: POS conversion transfers reservation without rededuction`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    db.pos.s = { id: "s", status: "completed" };
    await inventorySale(db, [item(2)], "pos", async () => db.pos.s);
    const convert = (id: string) => inventorySale(db, [item(2)], "order", async () => ({ id }), "s");
    const results = await Promise.allSettled([convert("a"), convert("b")]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(db.products.p.stock, 3);
    await assert.rejects(inventoryPosUpdate(db, "s", { status: "cancelled" }, async () => null), /converted order/);
  });
  test(`${label}: rejects nonintegral, zero and negative quantities`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    for (const qty of [0, -1, 1.5, NaN, Infinity]) await assert.rejects(db.transaction(tx => changeInventory(tx, [item(qty)])), /quantity/);
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: restore racing a sale preserves both writes`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    const reserved = await db.transaction(tx => changeInventory(tx, [item(2)]));
    await Promise.all([
      db.transaction(tx => restoreAllocations(tx, reserved)),
      inventorySale(db, [item(2)], "order", async () => ({ id: "a" })),
    ]);
    assert.equal(db.products.p.stock, 3);
  });
  test(`${label}: failed cancellation rolls back release and can retry`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    db.orders.a = { id: "a", status: "pending", payment_method: "cod" };
    await inventorySale(db, [item(2)], "order", async () => db.orders.a);
    await assert.rejects(inventoryOrderStatus(db, "a", "cancelled", async () => { throw new Error("status failure"); }), /status failure/);
    assert.equal(db.products.p.stock, 3);
    assert.equal(db.sales["order:a"].restored_at, null);
    await inventoryOrderStatus(db, "a", "cancelled", async () => { db.orders.a.status = "cancelled"; });
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: POS concurrent cancellations restore once`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    db.pos.s = { id: "s", status: "completed" };
    await inventorySale(db, [item(2)], "pos", async () => db.pos.s);
    const cancel = () => inventoryPosUpdate(db, "s", { status: "cancelled" }, async () => { db.pos.s.status = "cancelled"; });
    await Promise.all([cancel(), cancel()]);
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: preorder zero cap, expired and disabled reject under lock`, async () => {
    for (const extra of [{ pre_order_stock: 0 }, { is_pre_order: false }, { pre_order_deadline: "2000-01-01" }]) {
      const db = new FakeDb(pgShape, [product("p", extra)]);
      await assert.rejects(db.transaction(tx => changeInventory(tx, [item(1, { isPreOrder: true })])));
    }
  });
  test(`${label}: sale beats stale admin edit; description edit preserves new quantity`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    const sale = inventorySale(db, [item(2)], "order", async () => ({ id: "a" }));
    const edit = inventoryProductEdit(db, "p", { stock: 10, expectedInventory: { stock: 5 } }, async (_tx, data) => Object.assign(db.products.p, data));
    const results = await Promise.allSettled([sale, edit]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "rejected");
    assert.equal((results[1] as PromiseRejectedResult).reason.status, 409);
    assert.equal(db.products.p.stock, 3);
    await inventoryProductEdit(db, "p", { stock: 5, expectedInventory: { stock: 5 }, description: "Updated text" },
      async (_tx, data) => Object.assign(db.products.p, data));
    assert.equal(db.products.p.stock, 3);
    assert.equal(db.products.p.description, "Updated text");
    await inventoryProductEdit(db, "p", { stock: 10, expectedInventory: { stock: 3 } },
      async (_tx, data) => Object.assign(db.products.p, data));
    assert.equal(db.products.p.stock, 10);
  });
  test(`${label}: allocations prevent deletion and map removal`, async () => {
    const db = new FakeDb(pgShape, [product("p", { variant_stock: { "Standard-Default": 5 } })]);
    await inventorySale(db, [item(2)], "order", async () => ({ id: "a" }));
    await assert.rejects(inventoryProductEdit(db, "p", {}, async () => true, true), /outstanding/);
    await assert.rejects(inventoryProductEdit(db, "p", { variantStock: {}, expectedInventory: { variantStock: { "Standard-Default": 3 } } }, async () => true), /reserved inventory variant/);
    assert.equal(db.products.p.variant_stock["Standard-Default"], 3);
  });
  test(`${label}: explicit historical approval is audited, immutable and enables safe cancel`, async () => {
    const db = new FakeDb(pgShape, [product("p", { stock: 3 })]);
    db.orders.old = { id: "old", status: "pending", payment_method: "bank", items: [item(2)] };
    const body = { approved: true, note: "Verified original stock deduction and physical count.", allocations: [{ productId: "p", preOrder: false, total: true, qty: 2 }] };
    await assert.rejects(reconcileHistoricalInventory(db, "order", "old", { ...body, approved: false }, "admin"), /approval/);
    await reconcileHistoricalInventory(db, "order", "old", body, "admin");
    assert.equal(db.products.p.stock, 3, "approval must not change stock");
    assert.equal(db.sales["order:old"].reconciled_by, "admin");
    assert.equal(db.sales["order:old"].reconciliation_note, body.note);
    await assert.rejects(reconcileHistoricalInventory(db, "order", "old", body, "admin"), /already has/);
    await inventoryOrderStatus(db, "old", "cancelled", async () => { db.orders.old.status = "cancelled"; });
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: historical zero-outstanding approval does not inflate stock`, async () => {
    const db = new FakeDb(pgShape, [product()]);
    db.orders.old = { id: "old", status: "pending", payment_method: "bank", items: [item(2)] };
    await reconcileHistoricalInventory(db, "order", "old", { approved: true, note: "Verified this deduction was already restored earlier.", allocations: [] }, "admin");
    await inventoryOrderStatus(db, "old", "cancelled", async () => { db.orders.old.status = "cancelled"; });
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: catalog checkout ignores forged totals, item prices and privileged fields`, async () => {
    const db = new FakeDb(pgShape, [product("p", { name: "Real catalog name", price: 100, express_charge: 15 })]);
    const forged = checkoutInput({
      items: [item(2, { price: 0.01, name: "Forged", preOrderTotalPrice: 1, preOrderEta: "forged", category: "forged" })],
      subtotal: 0.02, total: 0.02, discount: 500, shipping: 0, shippingSpeed: "express",
      id: "attacker-id", invoiceNumber: "paid", status: "confirmed", adminNote: "forged", paymentStatus: "paid",
      statusHistory: [{ status: "confirmed" }],
    });
    const order = await createCatalogOrder(db, forged, async (_tx, payload) => ({ id: "real-id", ...payload }));
    assert.equal(order.total, 230);
    assert.equal(order.subtotal, 200);
    assert.equal(order.discount, 0);
    assert.equal(order.shipping, 30);
    assert.equal(order.items[0].price, 100);
    assert.equal(order.items[0].name, "Real catalog name");
    assert.equal(order.items[0].preOrderTotalPrice, undefined);
    assert.equal(order.items[0].preOrderEta, undefined);
    assert.equal(order.id, "real-id");
    assert.equal(order.status, "pending");
    assert.equal(order.invoiceNumber, undefined);
    assert.equal(order.adminNote, undefined);
    assert.equal(order.paymentStatus, undefined);
    assert.equal(db.products.p.stock, 3);
    assert.equal(db.sales["order:real-id"].allocations[0].qty, 2);
  });
  test(`${label}: normal bank preorder quote uses catalog deposit/balance, coupon and delivery`, async () => {
    const db = new FakeDb(pgShape, [product("p", {
      name: "Catalog preorder", price: 200, pre_order_price: 180, pre_order_initial_payment: 50,
      pre_order_eta: "Catalog arrival", pre_order_stock: 10, pre_order_variant_stock: { "Standard-Default": 10 }, express_charge: 7,
    })]);
    db.coupons.SAVE = { code: "SAVE", type: "percentage", discount: 10, status: "active", scope: "store", allow_pre_order: true };
    const order = await createCatalogOrder(db, checkoutInput({
      paymentMethod: "bank", shippingSpeed: "express", couponCode: "save",
      items: [item(2, { isPreOrder: true, price: 1, preOrderTotalPrice: 2, preOrderEta: "forged" })],
    }), async (_tx, payload) => ({ id: "bank", ...payload }));
    assert.equal(order.subtotal, 100);
    assert.equal(order.discount, 10);
    assert.equal(order.shipping, 14);
    assert.equal(order.total, 104);
    assert.equal(order.items[0].preOrderTotalPrice, 180);
    assert.equal(order.items[0].preOrderEta, "Catalog arrival");
    assert.equal(order.status, "payment_verification");
    assert.equal(db.products.p.pre_order_stock, 8);
    assert.equal(db.products.p.stock, 5);
  });
  test(`${label}: bad coupon, quantity, and failed insertion never consume stock`, async () => {
    const db = new FakeDb(pgShape, [product("p", { name: "Catalog", price: 100 })]);
    await assert.rejects(createCatalogOrder(db, checkoutInput({ couponCode: "INVALID" }), async () => ({ id: "bad" })), /Coupon/);
    await assert.rejects(createCatalogOrder(db, checkoutInput({ items: [item(-1)] }), async () => ({ id: "bad" })), /quantity/);
    await assert.rejects(createCatalogOrder(db, checkoutInput(), async () => { throw new Error("insert failed"); }), /insert failed/);
    assert.equal(db.products.p.stock, 5);
    assert.deepEqual(db.sales, {});
  });
}

function checkoutInput(extra: any = {}) {
  return {
    orderNumber: "ECOM-test", trackingNumber: "test", customerName: "Test buyer", customerEmail: "buyer@example.test",
    customerPhone: "1234567", shippingAddress: "Test address", paymentMethod: "cod", deliveryType: "male",
    items: [item()], ...extra,
  };
}
test("catalog quote honors variant sale prices, coupon scope, legacy standard speed and boat shipping", () => {
  const p = product("p", { name: "Catalog", price: 100, variants: [{ size: "M", price: 120 }], colors: ["Red"],
    is_on_sale: true, sale_percent: 25, express_charge: 10, category: "Shirts" });
  const input = checkoutInput({ items: [item(2, { size: "M", color: "Red" })] });
  assert.equal(calculateCatalogQuote(input, [p]).total, 180);
  assert.equal(calculateCatalogQuote({ ...input, shippingSpeed: "express" }, [p]).total, 200);
  assert.equal(calculateCatalogQuote({ ...input, deliveryType: "boat", shippingSpeed: "express" }, [p]).total, 180);
  const coupon = { code: "SAVE", type: "flat", discount: 25, status: "active", scope: "category", allowed_categories: ["Shirts"] };
  assert.equal(calculateCatalogQuote({ ...input, couponCode: "SAVE" }, [p], coupon).total, 155);
  assert.throws(() => calculateCatalogQuote({ ...input, couponCode: "SAVE" }, [p], { ...coupon, allowed_categories: ["Other"] }), /does not apply/);
  assert.throws(() => calculateCatalogQuote({ ...input, couponCode: "SAVE" }, [p], { ...coupon, status: "inactive" }), /invalid/);
  assert.throws(() => calculateCatalogQuote({ ...input, items: [item(2, { size: "M", color: "Red" }), item(2, { size: "M", color: "Red" })] }, [{ ...p, max_order_qty: 3 }]), /Maximum/);
});
test("both runtime entrypoints delegate public creation to locked catalog quote and preserve shippingSpeed", () => {
  const server = readFileSync("server/storage.ts", "utf8");
  const api = readFileSync("api/index.ts", "utf8");
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(api, /registerRoutes\(createServer\(app\), app\)/);
  for (const source of [server]) {
    const method = source.slice(source.indexOf("  async createOrder("), source.indexOf("  async updateOrderStatus("));
    assert.match(method, /if \(!fromPosId\) return createCatalogOrder\(/);
    assert.match(method, /\.values\(payload\)/);
    assert.match(method, /transferInventory\(/, "authenticated POS conversion remains separate");
  }
  for (const source of [routes]) {
    assert.match(source, /const data = \{ \.\.\.req\.body, orderNumber, trackingNumber \};/);
    assert.match(source, /const order = await storage\.createOrder\(data\)/);
  }
  assert.match(readFileSync("client/src/pages/Checkout.tsx", "utf8"), /deliveryType: deliveryLocation,\s+shippingSpeed: deliveryType/);
});

test("admin validation: no snapshot, stale map, fractional quantities and safe metadata edits", () => {
  assert.throws(() => prepareInventoryEdit(product(), { stock: 10 }), /Inventory changed/);
  assert.throws(() => prepareInventoryEdit(product("p", { variant_stock: { "S-Red": 2 } }), {
    variantStock: { "S-Red": 10 }, expectedInventory: { variantStock: { "S-Red": 5 } },
  }), /Inventory changed/);
  assert.throws(() => prepareInventoryEdit(product(), { stock: 1.5, expectedInventory: { stock: 5 } }), /integers/);
  assert.deepEqual(prepareInventoryEdit(product(), { price: 10, description: "Hello" }), { price: 10, description: "Hello" });
  assert.deepEqual(prepareInventoryEdit(product("p", { variant_stock: { a: 1, b: 2 } }), {
    variantStock: { a: 1, b: 2 }, expectedInventory: { variantStock: { b: 2, a: 1 } }, price: 10,
  }), { price: 10 });
});
test("reserved structure protection covers prepaid RedotPay-style and preorder allocations", () => {
  const p = product("p", { pre_order_stock: 10, variants: [{ size: "M", price: 10 }], colors: ["Red"] });
  assert.throws(() => protectAllocationStructure(p, { preOrderStock: null }, [{ preOrder: true, total: true, qty: 2 }]), /total cap/);
  assert.throws(() => protectAllocationStructure(p, { variantStock: { "M-Red": 10 } }, [{ preOrder: false, total: true, qty: 2 }]), /scalar inventory/);
  assert.throws(() => protectAllocationStructure(p, { colors: [] }, [{ key: "M-Red" }]), /colors/);
  assert.doesNotThrow(() => protectAllocationStructure(p, { variants: [{ size: "M", price: 20 }] }, [{ key: "M-Red" }]));
});
test("historical allocation validation refuses overclaims, wrong pool, negative and ambiguous allocations", () => {
  const items = [item(2)];
  const valid = { productId: "p", preOrder: false, total: true, qty: 2 };
  assert.throws(() => validateHistoricalAllocations(items, [{ ...valid, qty: 3 }]), /exceeds/);
  assert.throws(() => validateHistoricalAllocations(items, [{ ...valid, preOrder: true }]), /exceeds/);
  assert.throws(() => validateHistoricalAllocations(items, [{ ...valid, productId: "other" }]), /exceeds/);
  assert.throws(() => validateHistoricalAllocations(items, [{ ...valid, qty: -1 }]), /positive/);
  assert.throws(() => validateHistoricalAllocations(items, [{ ...valid, key: "M-Red" }]), /not both/);
  assert.deepEqual(validateHistoricalAllocations(items, []), []);
});

test("operator reconciliation routes authenticate, check both permissions and reject cross-origin before mutation", async () => {
  const handlers: Record<string, any> = {};
  let actor: any = null;
  let transactionCalls = 0;
  const db = {
    execute: async () => ({ rows: actor ? [actor] : [] }),
    transaction: async () => { transactionCalls++; throw new Error("not expected"); },
  };
  registerInventoryAdmin({
    get: (path: string, fn: any) => { handlers[`GET ${path}`] = fn; },
    post: (path: string, fn: any) => { handlers[`POST ${path}`] = fn; },
  } as any, () => db);
  const run = async (cookie: boolean, origin = "https://store.test") => {
    const result: any = { statusCode: 200 };
    const req: any = {
      method: "POST", secure: true, headers: { origin },
      params: { kind: "order", id: "old" }, body: {},
      get: (name: string) => ({ origin, host: "store.test", "sec-fetch-site": origin === "https://store.test" ? "same-origin" : "cross-site" } as any)[name],
    };
    const res: any = { locals: { admin: cookie ? actor : null }, setHeader: () => {}, status: (code: number) => { result.statusCode = code; return res; }, json: (body: any) => { result.body = body; } };
    req.res = res;
    await handlers["POST /api/inventory/reconcile/:kind/:id"](req, res);
    return result;
  };
  assert.equal((await run(false)).statusCode, 403);
  actor = { id: "admin", permissions: { canManageStock: true, canManageOrders: false } };
  assert.equal((await run(true)).statusCode, 403);
  actor.permissions.canManageOrders = true;
  assert.equal((await run(true, "https://attacker.test")).statusCode, 403);
  assert.equal((await run(true)).statusCode, 400, "authorized request reaches explicit approval validation");
  assert.equal(transactionCalls, 0);
});