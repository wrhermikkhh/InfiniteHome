import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { inventoryChange, mutateInventory, restoreInventory } from "../shared/legacy-inventory";

const product = (extra = {}) => ({ id: "a", stock: 5, variant_stock: {}, is_pre_order: true, pre_order_stock: null, pre_order_variant_stock: {}, ...extra });
const item = (extra = {}) => ({ productId: "a", qty: 2, size: "S", color: "Blue", ...extra });

test("regular general stock is deducted and cannot go negative", () => {
  assert.equal(inventoryChange(product(), item()).changes.stock, 3);
  assert.throws(() => inventoryChange(product(), item({ qty: 6 })), /Insufficient/);
});
test("strict case-insensitive full variant match, no size/color fallback", () => {
  const p = product({ variant_stock: { "s-blue": 4 } });
  assert.deepEqual(inventoryChange(p, item()).changes, { variant_stock: { "s-blue": 2 } });
  assert.throws(() => inventoryChange(p, item({ color: "Red" })), /unavailable/);
});
test("preorder cap and variant map both apply; null cap remains unlimited", () => {
  const p = product({ pre_order_stock: 3, pre_order_variant_stock: { "S-Blue": 4 } });
  assert.deepEqual(inventoryChange(p, item({ isPreOrder: true })).changes, { pre_order_stock: 1, pre_order_variant_stock: { "S-Blue": 2 } });
  assert.deepEqual(inventoryChange(product(), item({ isPreOrder: true })).changes, {});
  assert.throws(() => inventoryChange(product({ pre_order_stock: 0 }), item({ isPreOrder: true })), /Insufficient/);
});
test("invalid quantities and expired preorders fail", () => {
  for (const qty of [0, -1, 1.2, NaN, Infinity, "2"]) assert.throws(() => inventoryChange(product(), item({ qty })), /positive integer/);
  assert.throws(() => inventoryChange(product({ pre_order_deadline: "2000-01-01" }), item({ isPreOrder: true })), /not available/);
});

// Deliberately isolated driver mock. This does not connect to any database and is
// not a substitute for release-gated, real PostgreSQL multi-connection testing.
function harness(arrayDriver: boolean) {
  const products = new Map([["a", product()], ["b", product({ id: "b" })]]);
  const lockOrder: string[] = [];
  const ledger = { allocations: [{ productId: "a", qty: 2, key: null, preorder: false, capped: true }], restored_at: null as any };
  const wrap = (r: any[]) => arrayDriver ? r : { rows: r };
  const tx = { execute: async (statement: any) => {
    const { sql: text, params } = new PgDialect().sqlToQuery(statement);
    if (text.startsWith("SELECT * FROM products")) {
      assert.match(text, /FOR UPDATE$/);
      lockOrder.push(params[0] as string);
      return wrap([structuredClone(products.get(params[0] as string))]);
    }
    if (text.startsWith("UPDATE products")) {
      const field = text.match(/SET "([^"]+)"/)![1];
      const value = text.includes("::jsonb") ? JSON.parse(params[0] as string) : params[0];
      (products.get(params[1] as string) as any)[field] = value;
      return wrap([]);
    }
    if (text.startsWith("SELECT * FROM legacy_inventory")) return wrap([ledger]);
    if (text.startsWith("UPDATE legacy_inventory")) { ledger.restored_at = "restored"; return wrap([]); }
    throw new Error(`Unexpected test SQL: ${text}`);
  }};
  return { tx, products, lockOrder, ledger };
}

for (const arrayDriver of [false, true]) {
  test(`deterministic locks and duplicate-line aggregation (${arrayDriver ? "postgres-js" : "node-postgres"})`, async () => {
    const h = harness(arrayDriver);
    await mutateInventory(h.tx, [item({ productId: "b" }), item(), item()]);
    assert.deepEqual(h.lockOrder, ["a", "b"]);
    assert.equal(h.products.get("a")!.stock, 1);
    await assert.rejects(mutateInventory(h.tx, [item()]), /Insufficient/);
  });
  test(`restore ledger is idempotent (${arrayDriver ? "postgres-js" : "node-postgres"})`, async () => {
    const h = harness(arrayDriver);
    await restoreInventory(h.tx, "order", "order-1");
    await restoreInventory(h.tx, "order", "order-1");
    assert.equal(h.products.get("a")!.stock, 7);
    assert.deepEqual(h.lockOrder, ["a"]);
  });
}
test("custom POS items do not touch stock", async () => {
  const h = harness(true);
  assert.deepEqual(await mutateInventory(h.tx, [{ qty: 1, name: "Custom" }], false, true), []);
  assert.deepEqual(h.lockOrder, []);
});