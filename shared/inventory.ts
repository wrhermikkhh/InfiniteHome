import { sql } from "drizzle-orm";

export const inventoryRows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];
type Allocation = { productId: string; preOrder: boolean; key?: string; total: boolean; qty: number };

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
      const source = inventoryRows(await tx.execute(sql`SELECT * FROM inventory_sales WHERE kind = 'pos' AND sale_id = ${sourcePosId} FOR UPDATE`))[0];
      if (!source || source.released) throw new Error("Historical POS inventory needs reconciliation before conversion. Open Admin → Inventory → Historical inventory reconciliation and verify the outstanding deductions.");
      allocations = source.allocations;
    } else {
      // Custom POS lines carry no catalog inventory, but still require valid quantities.
      if (!Array.isArray(items) || !items.length || items.some(i => !Number.isSafeInteger(i.qty) || i.qty <= 0)) throw new Error("Invalid inventory quantity");
      const catalog = kind === "pos" ? items.filter(i => i.productId) : items;
      allocations = catalog.length ? await changeInventory(tx, catalog) : [];
    }
    const sale = await insert(tx);
    await tx.execute(sql`INSERT INTO inventory_sales (kind, sale_id, allocations) VALUES (${kind}, ${sale.id}, ${JSON.stringify(allocations)}::jsonb)`);
    if (sourcePosId) {
      await tx.execute(sql`UPDATE pos_transactions SET converted_to_order_id = ${sale.id} WHERE id = ${sourcePosId}`);
      await tx.execute(sql`UPDATE inventory_sales SET released = true WHERE kind = 'pos' AND sale_id = ${sourcePosId}`);
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
      const ledger = inventoryRows(await tx.execute(sql`SELECT * FROM inventory_sales WHERE kind = 'pos' AND sale_id = ${id} FOR UPDATE`))[0];
      if (!ledger) throw new Error("Historical POS inventory needs reconciliation before cancellation. Open Admin → Inventory → Historical inventory reconciliation and verify the outstanding deductions.");
      if (!ledger.released) {
        await restoreAllocations(tx, ledger.allocations);
        await tx.execute(sql`UPDATE inventory_sales SET released = true WHERE kind = 'pos' AND sale_id = ${id}`);
      }
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
      const ledger = inventoryRows(await tx.execute(sql`SELECT * FROM inventory_sales WHERE kind = 'order' AND sale_id = ${id} FOR UPDATE`))[0];
      if (ledger) {
        if (!ledger.released) {
          await restoreAllocations(tx, ledger.allocations);
          await tx.execute(sql`UPDATE inventory_sales SET released = true WHERE kind = 'order' AND sale_id = ${id}`);
        }
      } else {
        // Old runtimes disagreed about scalar/variant deductions and may already
        // have restored stock separately. Never guess and inflate live inventory.
        throw new Error("Historical order inventory needs reconciliation before cancellation. Open Admin → Inventory → Historical inventory reconciliation and verify the outstanding deductions.");
      }
    }
    return update(tx);
  });
}