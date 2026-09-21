import { sql } from "drizzle-orm";
import { inventoryRows } from "./inventory";

export class InventoryConflict extends Error {
  status = 409;
}
const fields: Record<string, string> = {
  stock: "stock", variantStock: "variant_stock",
  preOrderStock: "pre_order_stock", preOrderVariantStock: "pre_order_variant_stock",
};
const normalize = (value: any): any => Array.isArray(value) ? value.map(normalize)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])])) : value;
const same = (a: any, b: any) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
const conflict = () => new InventoryConflict("Inventory changed since this form was opened. Close and reopen the product to refresh quantities, then retry your stock changes.");

export function prepareInventoryEdit(current: any, input: any) {
  const { expectedInventory, ...data } = input;
  if ("id" in data && data.id !== current.id) throw new InventoryConflict("Product identity cannot be changed");
  delete data.id;
  for (const [field, column] of Object.entries(fields)) {
    if (!(field in data)) continue;
    const value = data[field];
    if (field.endsWith("VariantStock") || field === "variantStock") {
      if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.values(value).some(n => !Number.isSafeInteger(n) || (n as number) < 0)) throw new Error("Inventory quantities must be nonnegative integers");
    } else if (!(field === "preOrderStock" && value === null) && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error("Inventory quantities must be nonnegative integers");
    }
    if (!expectedInventory || !(field in expectedInventory)) throw conflict();
    // Unedited form quantities are not a stock command: omit them so normal
    // price/description edits do not overwrite intervening sales.
    if (same(value, expectedInventory[field])) {
      delete data[field];
      continue;
    }
    if (!same(current[column] ?? (field.includes("Variant") || field === "variantStock" ? {} : null), expectedInventory[field])) throw conflict();
  }
  return data;
}

export async function outstandingAllocations(tx: any, id: string) {
  const regular = inventoryRows(await tx.execute(sql`SELECT a.value AS allocation FROM legacy_inventory_reservations s,
    jsonb_array_elements(s.allocations) a WHERE s.restored_at IS NULL AND a.value->>'productId' = ${id}`))
    .map(r => ({ ...r.allocation, preOrder: r.allocation.preorder, total: r.allocation.capped }));
  // Inventory remains usable before RedotPay's separate migration is deployed.
  const installed = inventoryRows(await tx.execute(sql`SELECT to_regclass('redotpay_payments') AS relation`))[0]?.relation;
  if (installed) {
    regular.push(...inventoryRows(await tx.execute(sql`SELECT a.value AS allocation FROM redotpay_payments p,
      jsonb_array_elements(p.allocations) a WHERE p.state <> 'closed' AND a.value->>'productId' = ${id}`))
      .map(r => ({ ...r.allocation, total: r.allocation.preOrder ? !!r.allocation.total : !r.allocation.key })));
  }
  return regular;
}

export function protectAllocationStructure(current: any, data: any, allocations: any[], deleting = false) {
  if (!allocations.length) return;
  if (deleting) throw new InventoryConflict("This product has outstanding sale allocations. Reconcile/cancel those sales before deleting it.");
  for (const a of allocations) {
    const field = a.preOrder ? "preOrderVariantStock" : "variantStock";
    if (a.key && field in data && !Object.prototype.hasOwnProperty.call(data[field], a.key)) {
      throw new InventoryConflict(`Cannot remove reserved inventory variant "${a.key}". Reconcile/cancel its sales first.`);
    }
    if (a.preOrder && a.total && data.preOrderStock === null) throw new InventoryConflict("Cannot remove a pre-order total cap with outstanding allocations.");
    if (!a.preOrder && a.total && data.variantStock && Object.keys(data.variantStock).length) {
      throw new InventoryConflict("Cannot switch scalar inventory to variants while scalar allocations remain outstanding.");
    }
  }
  const oldSizes = (current.variants || []).map((v: any) => v.size);
  if (data.variants && oldSizes.some((size: string) => !data.variants.some((v: any) => v.size === size))) {
    throw new InventoryConflict("Cannot remove sizes while sale allocations remain outstanding.");
  }
  if (data.colors && (current.colors || []).some((color: string) => !data.colors.includes(color))) {
    throw new InventoryConflict("Cannot remove colors while sale allocations remain outstanding.");
  }
}

export async function inventoryProductEdit(db: any, id: string, input: any, update: (tx: any, data: any) => Promise<any>, deleting = false) {
  return db.transaction(async (tx: any) => {
    const current = inventoryRows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
    if (!current) return undefined;
    const data = prepareInventoryEdit(current, input);
    const structural = deleting || ["variantStock", "preOrderVariantStock", "preOrderStock", "variants", "colors"].some(k => k in data);
    if (structural) {
      protectAllocationStructure(current, data, await outstandingAllocations(tx, id), deleting);
      // Legacy active sales lack trustworthy allocations. Preserve their stock
      // structure until the operator explicitly records what remains reserved.
      const legacy = inventoryRows(await tx.execute(sql`SELECT id FROM orders o WHERE status <> 'cancelled'
        AND payment_method <> 'redotpay' AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) i WHERE i->>'productId' = ${id})
        AND NOT EXISTS (SELECT 1 FROM legacy_inventory_reservations s WHERE s.owner_type = 'order' AND s.owner_id = o.id)
        UNION ALL SELECT id FROM pos_transactions p WHERE status <> 'cancelled' AND converted_to_order_id IS NULL
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.items) i WHERE i->>'productId' = ${id})
        AND NOT EXISTS (SELECT 1 FROM legacy_inventory_reservations s WHERE s.owner_type = 'pos' AND s.owner_id = p.id) LIMIT 1`));
      if (legacy.length) {
        // Allow numeric edits and additions; only forbid actual removal.
        const oldMaps = [["variantStock", "variant_stock"], ["preOrderVariantStock", "pre_order_variant_stock"]];
        const removesMap = oldMaps.some(([f, c]) => f in data && Object.keys(current[c] || {}).some(k => !(k in data[f])));
        const removesSizes = data.variants && (current.variants || []).some((v: any) => !data.variants.some((n: any) => n.size === v.size));
        const removesColors = data.colors && (current.colors || []).some((c: string) => !data.colors.includes(c));
        const switchesScalarPool = !Object.keys(current.variant_stock || {}).length && data.variantStock && Object.keys(data.variantStock).length;
        if (deleting || removesMap || removesSizes || removesColors || switchesScalarPool || (current.pre_order_stock != null && data.preOrderStock === null)) {
          throw new InventoryConflict("Historical sales need inventory reconciliation before removing this product, variant, or cap. Use Inventory → Historical inventory reconciliation.");
        }
      }
    }
    return update(tx, data);
  });
}

export function validateHistoricalAllocations(items: any[], allocations: any[]) {
  if (!Array.isArray(allocations) || allocations.length > 500 || !Array.isArray(items)) throw new Error("Invalid allocation list");
  const available = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    if (!Number.isSafeInteger(item.qty) || item.qty <= 0) throw new Error("Historical sale quantity requires manual database review");
    const key = `${item.productId}:${!!item.isPreOrder}`;
    available.set(key, (available.get(key) || 0) + item.qty);
  }
  return allocations.map(a => {
    if (!a || typeof a.productId !== "string" || typeof a.preOrder !== "boolean" || typeof a.total !== "boolean" ||
      !Number.isSafeInteger(a.qty) || a.qty <= 0 || (a.key !== undefined && (typeof a.key !== "string" || !a.key.length || a.key.length > 300))) {
      throw new Error("Each allocation requires productId, preOrder, total, positive integer qty, and optional exact variant key");
    }
    if (!a.total && !a.key) throw new Error("Allocation must identify a deducted total or variant");
    if (!a.preOrder && a.total === !!a.key) throw new Error("Regular allocation must be scalar OR variant, not both");
    const group = `${a.productId}:${a.preOrder}`;
    const remaining = (available.get(group) || 0) - a.qty;
    if (remaining < 0) throw new Error("Allocation exceeds the original sale quantity or references an unrelated product");
    available.set(group, remaining);
    return { productId: a.productId, preOrder: a.preOrder, total: a.total, qty: a.qty, ...(a.key ? { key: a.key } : {}) };
  });
}

export async function reconcileHistoricalInventory(db: any, kind: string, id: string, body: any, actorId: string) {
  if (!["order", "pos"].includes(kind) || !id || !actorId) throw new Error("Invalid historical sale");
  if (!body || body.approved !== true || typeof body.note !== "string" || body.note.trim().length < 20 || body.note.length > 2000) {
    throw new Error("Explicit verification approval and an audit note of 20–2000 characters are required");
  }
  return db.transaction(async (tx: any) => {
    const sale = inventoryRows(await tx.execute(kind === "order"
      ? sql`SELECT * FROM orders WHERE id = ${id} FOR UPDATE`
      : sql`SELECT * FROM pos_transactions WHERE id = ${id} FOR UPDATE`))[0];
    if (!sale || sale.status === "cancelled" || (kind === "order" && sale.payment_method === "redotpay") || sale.converted_to_order_id) {
      throw new InventoryConflict("Sale cannot be reconciled here: missing, cancelled, converted, or managed by RedotPay.");
    }
    const existing = inventoryRows(await tx.execute(sql`SELECT * FROM legacy_inventory_reservations WHERE owner_type = ${kind} AND owner_id = ${id} FOR UPDATE`))[0];
    if (existing) throw new InventoryConflict("This sale already has an inventory ledger. Reconciliation cannot overwrite it.");
    const allocations = validateHistoricalAllocations(sale.items, body.allocations);
    for (const productId of Array.from(new Set(allocations.map(a => a.productId))).sort()) {
      const product = inventoryRows(await tx.execute(sql`SELECT * FROM products WHERE id = ${productId} FOR UPDATE`))[0];
      if (!product) throw new Error("Allocated product no longer exists; repair product inventory before reconciliation");
      for (const a of allocations.filter(a => a.productId === productId)) {
        const map = product[a.preOrder ? "pre_order_variant_stock" : "variant_stock"] || {};
        if (a.key && !Object.prototype.hasOwnProperty.call(map, a.key)) throw new Error("Allocated variant no longer exists; repair the exact stock key before reconciliation");
        if (a.total && product[a.preOrder ? "pre_order_stock" : "stock"] == null) throw new Error("Allocated total stock cap no longer exists");
      }
    }
    const recorded = allocations.map(a => ({ productId: a.productId, qty: a.qty, key: a.key ?? null, preorder: a.preOrder, capped: a.total }));
    await tx.execute(sql`INSERT INTO legacy_inventory_reservations (owner_type, owner_id, allocations, reconciled_by, reconciliation_note, reconciled_at)
      VALUES (${kind}, ${id}, ${JSON.stringify(recorded)}::jsonb, ${actorId}, ${body.note.trim()}, now())`);
    return { success: true, message: "Verified outstanding allocations recorded. No stock was changed. You may now retry cancellation or POS conversion." };
  });
}