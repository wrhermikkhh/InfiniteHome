import { sql } from "drizzle-orm";
import { recordInventory, restoreInventory, transferInventory } from "./legacy-inventory.js";
import { consumeCostLayers, type CostLayer } from "./admin-accounting-math.js";

export const inventoryRows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];
type Allocation = { productId: string; preOrder: boolean; key?: string; total: boolean; qty: number };

const rows = inventoryRows;
const accountingTables = new WeakMap<object, boolean>();

async function hasCostLedger(tx: any): Promise<boolean> {
  // The additive ledger is optional until its reviewed migration has been
  // applied. This keeps old databases and the public checkout path intact.
  const key = tx as object;
  if (accountingTables.has(key)) return accountingTables.get(key)!;
  const result = rows(await tx.execute(sql`SELECT
    to_regclass('public.inventory_batches') AS batches,
    to_regclass('public.sale_cogs_lines') AS cogs`));
  const present = Boolean(result[0]?.batches && result[0]?.cogs);
  accountingTables.set(key, present);
  return present;
}

type CostSlice = { batchId: string | null; quantity: number; unitCostMvr: number; confidence: "known" | "estimated" | "historical_unknown" };

export async function recordSaleCosts(tx: any, kind: string, saleId: string, items: any[]) {
  if (!(await hasCostLedger(tx)) || !items.length) return;
  const methodRows = rows(await tx.execute(sql`SELECT costing_method FROM accounting_settings WHERE id = 1`));
  const method = methodRows[0]?.costing_method === "AVERAGE" ? "AVERAGE" : "FIFO";
  const productIds = Array.from(new Set(items.filter(i => i.productId).map(i => String(i.productId)))).sort();
  const products = new Map<string, any>();
  for (const id of productIds) {
    const result = rows(await tx.execute(sql`SELECT id, cost_price FROM products WHERE id = ${id}`));
    if (result[0]) products.set(id, result[0]);
  }
  for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
    const item = items[lineIndex];
    if (!item.productId) continue;
    const productId = String(item.productId);
    const key = `${item.size || "Standard"}-${item.color || "Default"}`;
    // Lock candidate layers in deterministic id order. FIFO selection is
    // applied after locking, so concurrent sales cannot consume one layer twice.
    const batches = rows(await tx.execute(sql`SELECT id, quantity_remaining, unit_landed_cost_mvr, arrived_at
      FROM inventory_batches
      WHERE product_id = ${productId}
        AND quantity_remaining > 0
        AND (variant_key = ${key} OR variant_key IS NULL)
      ORDER BY id
      FOR UPDATE`)).sort((a: any, b: any) =>
        String(a.arrived_at || "").localeCompare(String(b.arrived_at || "")) || String(a.id).localeCompare(String(b.id)));
    const layers: CostLayer[] = batches.map((b: any) => ({
      quantity: Math.floor(Number(b.quantity_remaining)),
      unitCostMinor: Math.max(0, Math.round(Number(b.unit_landed_cost_mvr) * 100)),
    })).filter((layer: CostLayer) => layer.quantity > 0);
    const slices: CostSlice[] = [];
    let remaining = Number(item.qty);
    if (layers.length && remaining > 0) {
      const consumed = consumeCostLayers(layers, Math.min(remaining, layers.reduce((n, l) => n + l.quantity, 0)), method as any);
      let left = consumed.costMinor;
      let need = Math.min(remaining, layers.reduce((n, l) => n + l.quantity, 0));
      for (const batch of batches) {
        if (!need) break;
        const available = Math.floor(Number(batch.quantity_remaining));
        const used = Math.min(available, need);
        if (!used) continue;
        const unit = Math.max(0, Math.round(Number(batch.unit_landed_cost_mvr) * 100));
        // FIFO has exact layer costs. Average uses the calculated average and
        // allocates the rounded total to the last slice to preserve cents.
        const amount = method === "AVERAGE" ? (need === used ? left : Math.min(left, used * Math.round(consumed.costMinor / Math.max(1, need)))) : used * unit;
        left -= amount;
        slices.push({ batchId: String(batch.id), quantity: used, unitCostMvr: amount / used / 100, confidence: "known" });
        await tx.execute(sql`UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ${used} WHERE id = ${batch.id}`);
        need -= used;
      }
      remaining -= Math.min(remaining, layers.reduce((n, l) => n + l.quantity, 0));
    }
    if (remaining > 0) {
      const cost = Number(products.get(productId)?.cost_price);
      const confidence = Number.isFinite(cost) && cost >= 0 ? "estimated" : "historical_unknown";
      slices.push({ batchId: null, quantity: remaining, unitCostMvr: confidence === "estimated" ? cost : 0, confidence });
    }
    for (const slice of slices) {
      await tx.execute(sql`INSERT INTO sale_cogs_lines
        (sale_kind, sale_id, line_index, batch_id, quantity, unit_cost_mvr, total_cost_mvr, confidence)
        VALUES (${kind.toUpperCase()}, ${saleId}, ${lineIndex}, ${slice.batchId}, ${slice.quantity},
          ${slice.unitCostMvr}, ${slice.quantity * slice.unitCostMvr}, ${slice.confidence})`);
    }
  }
}

export async function restoreSaleCosts(tx: any, kind: string, saleId: string) {
  if (!(await hasCostLedger(tx))) return;
  const lines = rows(await tx.execute(sql`SELECT id, batch_id, quantity FROM sale_cogs_lines
    WHERE sale_kind = ${kind.toUpperCase()} AND sale_id = ${saleId} AND reversed_at IS NULL ORDER BY id FOR UPDATE`));
  for (const line of lines) {
    if (line.batch_id) {
      await tx.execute(sql`UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ${line.quantity} WHERE id = ${line.batch_id}`);
    }
    await tx.execute(sql`UPDATE sale_cogs_lines SET reversed_at = now() WHERE id = ${line.id} AND reversed_at IS NULL`);
  }
}

export async function transferSaleCosts(tx: any, posId: string, orderId: string) {
  if (!(await hasCostLedger(tx))) return;
  await tx.execute(sql`UPDATE sale_cogs_lines SET sale_kind = 'ORDER', sale_id = ${orderId}
    WHERE sale_kind = 'POS' AND sale_id = ${posId} AND reversed_at IS NULL`);
}

// Must be called inside the same transaction as the sale. Acquire every product
// lock in ID order, including when multiple basket lines resolve to one variant.
export async function changeInventory(tx: any, items: any[], restore = false): Promise<Allocation[]> {
  if (!Array.isArray(items) || !items.length) throw new Error("Invalid inventory items");
  for (const item of items) {
    if (!item.productId || !Number.isSafeInteger(item.qty) || item.qty <= 0) throw new Error("Invalid inventory quantity");
  }
  const allocations: Allocation[] = [];
  for (const id of Array.from(new Set(items.map(i => String(i.productId)))).sort()) {
    const p = inventoryRows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
    if (!p) throw new Error("Product not found");
    for (const item of items.filter(i => String(i.productId) === id)) {
      const preOrder = !!item.isPreOrder;
      if (!restore && preOrder && (!p.is_pre_order || (p.pre_order_deadline && new Date().toISOString().slice(0, 10) >= p.pre_order_deadline))) {
        throw new Error("Pre-order is no longer available");
      }
      const map = { ...(preOrder ? p.pre_order_variant_stock : p.variant_stock) };
      const size = item.size || "Standard", color = item.color || "Default";
      if (!restore && ((size !== "Standard" && p.variants?.length && !p.variants.some((v: any) => v.size === size))
        || (color !== "Default" && p.colors?.length && !p.colors.includes(color)))) throw new Error("Invalid inventory variant");
      const wanted = `${size}-${color}`;
      let key = Object.keys(map).find(k => k === wanted) || Object.keys(map).find(k => k.toLowerCase() === wanted.toLowerCase());
      // Regular inventory historically accepts size-only, then color-only matches.
      if (!key && !preOrder) key = Object.keys(map).find(k => k.toLowerCase().startsWith(size.toLowerCase() + "-"))
        || Object.keys(map).find(k => k.toLowerCase().endsWith("-" + color.toLowerCase()));
      if (Object.keys(map).length && !key) throw new Error("Stock variant is not available");
      const total = preOrder ? p.pre_order_stock !== null && p.pre_order_stock !== undefined : !Object.keys(map).length;
      const field = preOrder ? "pre_order_stock" : "stock";
      if (!restore && ((key && (map[key] || 0) < item.qty) || (total && (p[field] || 0) < item.qty))) {
        throw new Error("Stock is no longer available");
      }
      const delta = restore ? item.qty : -item.qty;
      if (key) map[key] = (map[key] || 0) + delta;
      if (total) p[field] = (p[field] || 0) + delta;
      p[preOrder ? "pre_order_variant_stock" : "variant_stock"] = map;
      const previous = allocations.find(a => a.productId === id && a.preOrder === preOrder && a.key === key && a.total === total);
      if (previous) {
        previous.qty += item.qty;
        if (!Number.isSafeInteger(previous.qty)) throw new Error("Invalid aggregate inventory quantity");
      }
      else allocations.push({ productId: id, preOrder, key, total, qty: item.qty });
    }
    await writeProduct(tx, p);
  }
  return allocations;
}

async function writeProduct(tx: any, p: any) {
  await tx.execute(sql`UPDATE products SET stock = ${p.stock},
    variant_stock = ${JSON.stringify(p.variant_stock || {})}::jsonb,
    pre_order_stock = ${p.pre_order_stock},
    pre_order_variant_stock = ${JSON.stringify(p.pre_order_variant_stock || {})}::jsonb WHERE id = ${p.id}`);
}

export async function restoreAllocations(tx: any, allocations: Allocation[]) {
  for (const id of Array.from(new Set(allocations.map(a => a.productId))).sort()) {
    const p = inventoryRows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
    if (!p) throw new Error("Product missing while restoring inventory");
    for (const a of allocations.filter(a => a.productId === id)) {
      const mapField = a.preOrder ? "pre_order_variant_stock" : "variant_stock";
      const totalField = a.preOrder ? "pre_order_stock" : "stock";
      if (a.key) {
        p[mapField] = { ...(p[mapField] || {}) };
        if (p[mapField][a.key] === undefined) throw new Error("Reserved inventory variant was removed");
        p[mapField][a.key] += a.qty;
      }
      if (a.total) {
        if (p[totalField] == null) throw new Error("Reserved inventory cap was removed");
        p[totalField] += a.qty;
      }
    }
    await writeProduct(tx, p);
  }
}

export async function inventorySale(db: any, items: any[], kind: string, insert: (tx: any) => Promise<any>, sourcePosId?: string) {
  return db.transaction(async (tx: any) => {
    let allocations: Allocation[];
    if (sourcePosId) {
      const pos = inventoryRows(await tx.execute(sql`SELECT * FROM pos_transactions WHERE id = ${sourcePosId} FOR UPDATE`))[0];
      if (!pos || pos.converted_to_order_id || pos.status === "cancelled") throw new Error("POS transaction cannot be converted");
      const source = inventoryRows(await tx.execute(sql`SELECT * FROM legacy_inventory_reservations WHERE owner_type = 'pos' AND owner_id = ${sourcePosId} FOR UPDATE`))[0];
      if (!source || source.restored_at) throw new Error("Historical POS inventory needs reconciliation before conversion. Open Admin → Inventory → Historical inventory reconciliation and verify the outstanding deductions.");
      allocations = source.allocations.map((a: any) => ({ productId: a.productId, preOrder: a.preorder, total: a.capped, key: a.key ?? undefined, qty: a.qty }));
    } else {
      // Custom POS lines carry no catalog inventory, but still require valid quantities.
      if (!Array.isArray(items) || !items.length || items.some(i => !Number.isSafeInteger(i.qty) || i.qty <= 0)) throw new Error("Invalid inventory quantity");
      const catalog = kind === "pos" ? items.filter(i => i.productId) : items;
      allocations = catalog.length ? await changeInventory(tx, catalog) : [];
    }
    const sale = await insert(tx);
    if (sourcePosId) {
      await transferInventory(tx, sourcePosId, sale.id);
      await transferSaleCosts(tx, sourcePosId, sale.id);
      await tx.execute(sql`UPDATE pos_transactions SET converted_to_order_id = ${sale.id} WHERE id = ${sourcePosId}`);
    } else {
      await recordInventory(tx, kind, sale.id, allocations.map(a => ({ productId: a.productId, qty: a.qty, key: a.key ?? null, preorder: a.preOrder, capped: a.total })));
      await recordSaleCosts(tx, kind, sale.id, items.filter(i => kind !== "pos" || i.productId));
    }
    return sale;
  });
}

export async function inventoryPosUpdate(db: any, id: string, data: any, update: (tx: any) => Promise<any>) {
  return db.transaction(async (tx: any) => {
    const pos = inventoryRows(await tx.execute(sql`SELECT * FROM pos_transactions WHERE id = ${id} FOR UPDATE`))[0];
    if (!pos) return undefined;
    if (data.items !== undefined || data.convertedToOrderId !== undefined) throw new Error("POS inventory items cannot be edited after sale");
    if (pos.status === "cancelled" && data.status && data.status !== "cancelled") throw new Error("Cancelled POS sales cannot be reopened");
    if (data.status === "cancelled" && pos.status !== "cancelled") {
      if (pos.converted_to_order_id) throw new Error("Cancel the converted order instead");
      await restoreInventory(tx, "pos", id);
      await restoreSaleCosts(tx, "pos", id);
    }
    return update(tx);
  });
}

// Lock the order before checking its state. Stock and status commit together.
export async function inventoryOrderStatus(db: any, id: string, status: string, update: (tx: any) => Promise<any>) {
  return db.transaction(async (tx: any) => {
    const order = inventoryRows(await tx.execute(sql`SELECT * FROM orders WHERE id = ${id} FOR UPDATE`))[0];
    if (!order) return undefined;
    if (order.payment_method === "redotpay") throw new Error("RedotPay orders require payment reconciliation");
    if (order.status === "cancelled" && status !== "cancelled") throw new Error("Cancelled orders cannot be reopened");
    if (status === "cancelled" && order.status !== "cancelled") {
      await restoreInventory(tx, "order", id);
      await restoreSaleCosts(tx, "order", id);
    }
    return update(tx);
  });
}