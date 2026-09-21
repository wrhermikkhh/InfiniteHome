import type { Express, Request } from "express";
import { sql } from "drizzle-orm";
import { getAuthenticatedAdmin, hasAdminPermission, isSameOrigin } from "./admin-security";
import { inventoryRows } from "./inventory";
import { reconcileHistoricalInventory } from "./inventory-admin";

export function registerInventoryAdmin(app: Express, getDb: () => any) {
  async function operator(req: Request) {
    const admin = await getAuthenticatedAdmin(req, getDb());
    if (!admin || !hasAdminPermission(admin, "canManageStock") || !hasAdminPermission(admin, "canManageOrders")) {
      throw Object.assign(new Error("Inventory reconciliation requires inventory and order management permissions"), { status: 403 });
    }
    if (req.method !== "GET") {
      if (!isSameOrigin(req)) {
        throw Object.assign(new Error("Inventory reconciliation requires a same-origin admin request"), { status: 403 });
      }
    }
    return admin;
  }
  const handle = (fn: any) => async (req: any, res: any) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); } catch (error: any) {
      const status = error.status === 403 ? 403 : error.status === 409 ? 409 : 400;
      // Do not expose database messages or query contents.
      const message = error.code || error.cause ? "Inventory reconciliation could not complete. Check the inventory migration and retry." : error.message;
      res.status(status).json({ message });
    }
  };
  app.get("/api/inventory/reconcile/:kind/:id", handle(async (req: any, res: any) => {
    await operator(req);
    const { kind, id } = req.params;
    if (!["order", "pos"].includes(kind)) throw new Error("Choose order or POS");
    const db = getDb();
    const sale = inventoryRows(await db.execute(kind === "order"
      ? sql`SELECT id, order_number AS reference, items, status, payment_method FROM orders WHERE id = ${id} OR order_number = ${id} LIMIT 1`
      : sql`SELECT id, transaction_number AS reference, items, status, converted_to_order_id FROM pos_transactions WHERE id = ${id} OR transaction_number = ${id} LIMIT 1`))[0];
    if (!sale) throw new Error("Sale not found. Enter the full order/POS reference or internal ID.");
    const ledger = inventoryRows(await db.execute(sql`SELECT allocations, released, reconciled_by, reconciliation_note, reconciled_at
      FROM inventory_sales WHERE kind = ${kind} AND sale_id = ${sale.id}`))[0];
    const products = [];
    for (const productId of Array.from(new Set((sale.items || []).map((i: any) => i.productId).filter(Boolean)))) {
      const p = inventoryRows(await db.execute(sql`SELECT id, name, stock, variant_stock, pre_order_stock, pre_order_variant_stock
        FROM products WHERE id = ${productId}`))[0];
      if (p) products.push(p);
    }
    res.json({ sale, ledger: ledger || null, products });
  }));
  app.post("/api/inventory/reconcile/:kind/:id", handle(async (req: any, res: any) => {
    const admin = await operator(req);
    res.json(await reconcileHistoricalInventory(getDb(), req.params.kind, req.params.id, req.body, admin.id));
  }));
}