import { sql } from "drizzle-orm";

// Both drivers use this module; no connection or environment access at import time.
const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows;
export type Allocation = { productId: string; qty: number; key: string | null; preorder: boolean; capped: boolean };

export function inventoryChange(product: any, item: any, restore = false) {
  const qty = item.qty;
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error("Inventory quantity must be a positive integer");
  const preorder = !!item.isPreOrder;
  if (!restore && preorder && (!product.is_pre_order || (product.pre_order_deadline && new Date().toISOString().slice(0, 10) >= product.pre_order_deadline.slice(0, 10)))) {
    throw new Error("Pre-order is not available");
  }
  const field = preorder ? "pre_order_variant_stock" : "variant_stock";
  const map = { ...(product[field] || {}) };
  const requested = `${item.size || "Standard"}-${item.color || "Default"}`;
  const key = Object.keys(map).find(k => k.toLowerCase() === requested.toLowerCase());
  if (Object.keys(map).length && key === undefined) throw new Error(`Variant ${requested} is unavailable`);
  const delta = restore ? qty : -qty;
  if (key !== undefined) {
    if (!Number.isSafeInteger(map[key]) || map[key] + delta < 0) throw new Error("Insufficient variant stock");
    map[key] += delta;
  }
  const capped = preorder ? product.pre_order_stock != null : key === undefined;
  const capField = preorder ? "pre_order_stock" : "stock";
  if (capped && (!Number.isSafeInteger(product[capField]) || product[capField] + delta < 0)) throw new Error("Insufficient stock");
  return {
    allocation: { productId: product.id, qty, key: key ?? null, preorder, capped } as Allocation,
    changes: { ...(key !== undefined ? { [field]: map } : {}), ...(capped ? { [capField]: product[capField] + delta } : {}) },
  };
}

async function writeChanges(tx: any, id: string, changes: Record<string, any>) {
  for (const [field, value] of Object.entries(changes)) {
    // Field names are internal constants, never user input.
    await tx.execute(sql`UPDATE products SET ${sql.identifier(field)} = ${typeof value === "object" ? sql`${JSON.stringify(value)}::jsonb` : sql`${value}`} WHERE id = ${id}`);
  }
}

export async function mutateInventory(tx: any, items: any[], restore = false, pos = false): Promise<Allocation[]> {
  if (!Array.isArray(items) || !items.length) throw new Error("Inventory items are required");
  if (items.some(i => !Number.isSafeInteger(i.qty) || i.qty <= 0)) throw new Error("Inventory quantity must be a positive integer");
  if (pos) items = items.filter(i => i.productId); // Explicit custom POS lines have no inventory.
  if (items.some(i => !i.productId || typeof i.productId !== "string")) throw new Error("Inventory product ID is required");
  const products = new Map<string, any>();
  // Same ascending PostgreSQL ordering as RedotPay's SELECT ... ORDER BY id FOR UPDATE.
  const ids = Array.from(new Set<string>(items.map(i => i.productId))).sort();
  for (const id of ids) {
    const product = rows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
    if (!product) throw new Error(`Inventory product not found: ${id}`);
    products.set(id, product);
  }
  const allocations: Allocation[] = [];
  for (const original of items) {
    const product = products.get(original.productId);
    const item = pos ? { ...original, size: original.size || product.variants?.[0]?.size || "Standard", color: original.color || product.colors?.[0] || "Default" } : original;
    const { allocation, changes } = inventoryChange(product, item, restore);
    await writeChanges(tx, product.id, changes);
    Object.assign(product, changes); // Aggregate duplicate lines against the locked balance.
    allocations.push(allocation);
  }
  return allocations;
}

export async function recordInventory(tx: any, ownerType: string, ownerId: string, allocations: Allocation[]) {
  await tx.execute(sql`INSERT INTO legacy_inventory_reservations (owner_type, owner_id, allocations) VALUES (${ownerType}, ${ownerId}, ${JSON.stringify(allocations)}::jsonb)`);
}

export async function restoreInventory(tx: any, ownerType: string, ownerId: string) {
  const ledger = rows(await tx.execute(sql`SELECT * FROM legacy_inventory_reservations WHERE owner_type = ${ownerType} AND owner_id = ${ownerId} FOR UPDATE`))[0];
  if (!ledger) throw new Error("Historical inventory allocation needs operator reconciliation before cancellation");
  if (ledger.restored_at) return;
  const allocations = ledger.allocations as Allocation[];
  const locked = new Map<string, any>();
  for (const id of Array.from(new Set(allocations.map(a => a.productId))).sort()) {
    const p = rows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
    if (!p) throw new Error("Cannot restore deleted product; operator reconciliation required");
    locked.set(id, p);
  }
  for (const a of allocations) {
    const p = locked.get(a.productId);
    const changes: Record<string, any> = {};
    const mapField = a.preorder ? "pre_order_variant_stock" : "variant_stock";
    const capField = a.preorder ? "pre_order_stock" : "stock";
    if (a.key !== null) {
      const map = { ...(p[mapField] || {}) };
      if (!Number.isSafeInteger(map[a.key])) throw new Error("Variant configuration changed; operator reconciliation required");
      changes[mapField] = { ...map, [a.key]: map[a.key] + a.qty };
    }
    if (a.capped) {
      if (!Number.isSafeInteger(p[capField])) throw new Error("Stock cap changed; operator reconciliation required");
      changes[capField] = p[capField] + a.qty;
    }
    await writeChanges(tx, p.id, changes);
    Object.assign(p, changes);
  }
  await tx.execute(sql`UPDATE legacy_inventory_reservations SET restored_at = now() WHERE owner_type = ${ownerType} AND owner_id = ${ownerId}`);
}

export async function transferInventory(tx: any, posId: string, orderId: string) {
  const ledger = rows(await tx.execute(sql`UPDATE legacy_inventory_reservations SET owner_type = 'order', owner_id = ${orderId} WHERE owner_type = 'pos' AND owner_id = ${posId} AND restored_at IS NULL RETURNING owner_id`));
  if (!ledger.length) throw new Error("POS inventory allocation needs operator reconciliation before conversion");
}