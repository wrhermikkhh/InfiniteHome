import type { Express, Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getAuthenticatedAdmin, hasAdminPermission, isSameOrigin, securityRows } from "./admin-security.js";

type Database = {
  execute: (query: any) => Promise<any>;
  transaction?: (callback: (tx: Database) => Promise<any>) => Promise<any>;
};

const positiveQuantity = z.number().finite().int().positive().max(1_000_000);
const nonNegativeMoney = z.number().finite().min(0).max(1_000_000_000);
const variantKey = z.string().trim().min(1).max(300);
const arrivalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Arrival date must be YYYY-MM-DD")
  .refine(value => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Arrival date is not a valid calendar date");

const receiptInput = z.object({
  productId: z.string().trim().min(1).max(100),
  variantKey: variantKey.nullable().optional(),
  quantity: positiveQuantity,
  supplierId: z.string().trim().min(1).max(100).optional(),
  supplierName: z.string().trim().min(1).max(200).optional(),
  supplierCost: nonNegativeMoney,
  costCurrency: z.enum(["MVR", "USD"]).default("MVR"),
  exchangeRate: z.number().finite().positive().max(1_000_000).optional(),
  landedCostMvr: nonNegativeMoney.optional(),
  arrivedAt: arrivalDate.optional(),
  reference: z.string().trim().max(300).nullable().optional(),
  receiptKey: z.string().trim().min(1).max(200),
}).strict().superRefine((value, ctx) => {
  if (!value.supplierId && !value.supplierName) ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Supplier is required" });
  if (value.costCurrency === "USD" && value.exchangeRate === undefined) {
    ctx.addIssue({ code: "custom", path: ["exchangeRate"], message: "A manual USD exchange rate is required" });
  }
});

const adjustmentRow = z.object({
  productId: z.string().trim().min(1).max(100),
  variantKey: variantKey.nullable().optional(),
  expectedBalance: z.number().finite().int().nonnegative().max(1_000_000),
  targetBalance: z.number().finite().int().nonnegative().max(1_000_000).optional(),
  delta: z.number().finite().int().max(1_000_000).min(-1_000_000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.targetBalance === undefined && value.delta === undefined) ctx.addIssue({ code: "custom", path: ["targetBalance"], message: "Target balance or delta is required" });
  if (value.targetBalance !== undefined && value.delta !== undefined) ctx.addIssue({ code: "custom", path: ["targetBalance"], message: "Use target balance or delta, not both" });
});
const adjustmentInput = z.object({
  reason: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(300).nullable().optional(),
  rows: z.array(adjustmentRow).min(1).max(500),
}).strict().superRefine((value, ctx) => {
  const keys = new Set<string>();
  for (const row of value.rows) {
    const key = `${row.productId}\u0000${row.variantKey ?? ""}`;
    if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["rows"], message: "Each product and variant may appear only once" });
    keys.add(key);
  }
});

export type ReceiptInput = z.infer<typeof receiptInput>;
export type AdjustmentInput = z.infer<typeof adjustmentInput>;
export function validateReceiptInput(value: unknown) { return receiptInput.safeParse(value); }
export function validateBulkAdjustmentInput(value: unknown) { return adjustmentInput.safeParse(value); }
export const inventoryResultRows = (result: any): any[] => Array.isArray(result) ? result : result?.rows || [];
const numericEqual = (left: unknown, right: unknown) => Number(left) === Number(right);
const dateDay = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10);
export function receiptPayloadMatches(existing: any, input: ReceiptInput, supplierId: string): boolean {
  return existing?.product_id === input.productId
    && (existing.variant_key ?? null) === (input.variantKey ?? null)
    && numericEqual(existing.quantity_received, input.quantity)
    && existing.supplier_id === supplierId
    && numericEqual(existing.supplier_cost, input.supplierCost)
    && existing.cost_currency === input.costCurrency
    && numericEqual(existing.exchange_rate ?? 0, input.exchangeRate ?? 0)
    && numericEqual(existing.unit_landed_cost_mvr, input.landedCostMvr ?? (input.costCurrency === "USD" ? input.supplierCost * input.exchangeRate! : input.supplierCost))
    && (existing.reference ?? null) === (input.reference ?? null)
    && (input.arrivedAt === undefined || dateDay(existing.arrived_at) === input.arrivedAt);
}

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
async function operator(req: Request, db: Database, write = false) {
  const admin = await getAuthenticatedAdmin(req, db);
  if (!admin || !hasAdminPermission(admin, "canManageStock")) fail("Inventory management permission required", 403);
  if (write && !isSameOrigin(req)) fail("Same-origin request required", 403);
  return admin;
}
function transaction(db: Database, callback: (tx: Database) => Promise<any>) {
  return db.transaction ? db.transaction(callback) : callback(db);
}

async function supplier(db: Database, input: ReceiptInput) {
  if (input.supplierId) {
    const found = inventoryResultRows(await db.execute(sql`SELECT id, name, contact FROM suppliers WHERE id = ${input.supplierId}`))[0];
    if (!found) fail("Supplier not found", 400);
    return found;
  }
  const name = input.supplierName!;
  return inventoryResultRows(await db.execute(sql`
    INSERT INTO suppliers (name) VALUES (${name})
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name, contact`))[0];
}
async function supplierIdForExisting(db: Database, input: ReceiptInput): Promise<string | null> {
  if (input.supplierId) return input.supplierId;
  const found = inventoryResultRows(await db.execute(sql`SELECT id FROM suppliers WHERE name = ${input.supplierName!}`))[0];
  return found?.id || null;
}

async function productBalance(tx: Database, productId: string, key: string | null) {
  const row = inventoryResultRows(await tx.execute(sql`SELECT id, stock, variant_stock FROM products WHERE id = ${productId} FOR UPDATE`))[0];
  if (!row) fail("Product not found", 404);
  const map = row.variant_stock && typeof row.variant_stock === "object" ? { ...row.variant_stock } : {};
  if (key !== null && map[key] === undefined) fail("Inventory variant is not available", 400);
  const before = key === null ? Number(row.stock || 0) : Number(map[key] || 0);
  if (!Number.isSafeInteger(before) || before < 0) fail("Product inventory is invalid", 409);
  return { row, map, before };
}

export function registerAdminInventoryRoutes(app: Express, getDb: () => Database) {
  const handle = (fn: (req: Request, res: any) => Promise<void>) => async (req: Request, res: any) => {
    try { await fn(req, res); }
    catch (error: any) {
      const status = error?.status === 403 ? 403 : error?.status === 404 ? 404 : error?.status === 409 ? 409 : 400;
      if (status >= 500) console.error("Admin inventory operation failed:", error?.name || "unknown");
      res.status(status).json({ message: status >= 500 ? "Inventory operation unavailable. Retry later." : error?.message || "Invalid inventory request" });
    }
  };

  app.get("/api/admin/inventory/suppliers", handle(async (req, res) => {
    await operator(req, getDb());
    res.json(inventoryResultRows(await getDb().execute(sql`SELECT id, name, contact FROM suppliers ORDER BY name ASC`)));
  }));
  app.post("/api/admin/inventory/suppliers", handle(async (req, res) => {
    const admin = await operator(req, getDb(), true);
    const input = z.object({ name: z.string().trim().min(1).max(200), contact: z.string().trim().max(300).nullable().optional() }).strict().safeParse(req.body);
    if (!input.success) fail("Supplier name and contact are required");
    const created = inventoryResultRows(await getDb().execute(sql`
      INSERT INTO suppliers (name, contact) VALUES (${input.data.name}, ${input.data.contact ?? null})
      ON CONFLICT (name) DO UPDATE SET contact = COALESCE(EXCLUDED.contact, suppliers.contact)
      RETURNING id, name, contact`))[0];
    res.status(201).json(created);
  }));
  app.get("/api/admin/inventory/batches", handle(async (req, res) => {
    await operator(req, getDb());
    const productId = typeof req.query.productId === "string" ? req.query.productId : null;
    const rows = inventoryResultRows(await getDb().execute(sql`
      SELECT b.*, s.name AS supplier_name FROM inventory_batches b
      LEFT JOIN suppliers s ON s.id = b.supplier_id
      WHERE (${productId} IS NULL OR b.product_id = ${productId})
      ORDER BY b.arrived_at ASC, b.id ASC`));
    res.json(rows);
  }));
  app.get("/api/admin/inventory/movements", handle(async (req, res) => {
    await operator(req, getDb());
    const productId = typeof req.query.productId === "string" ? req.query.productId : null;
    res.json(inventoryResultRows(await getDb().execute(sql`
      SELECT m.*, a.name AS actor_name FROM inventory_movements m
      LEFT JOIN admins a ON a.id = m.actor_id
      WHERE (${productId} IS NULL OR m.product_id = ${productId})
      ORDER BY m.created_at DESC, m.id DESC LIMIT 500`)));
  }));
  app.post("/api/admin/inventory/receipts", handle(async (req, res) => {
    const admin = await operator(req, getDb(), true);
    const parsed = validateReceiptInput(req.body);
    if (!parsed.success) fail("Check product, quantity, supplier, cost and receipt key");
    const input = parsed.data;
    const result = await transaction(getDb(), async tx => {
      const existingBeforeLock = inventoryResultRows(await tx.execute(sql`SELECT * FROM inventory_batches WHERE receipt_key = ${input.receiptKey}`))[0];
      if (existingBeforeLock) {
        const existingSupplierId = await supplierIdForExisting(tx, input);
        if (!existingSupplierId || !receiptPayloadMatches(existingBeforeLock, input, existingSupplierId)) fail("Receipt key was already used for a different receipt", 409);
        return { batch: existingBeforeLock, idempotent: true };
      }
      const sup = await supplier(tx, input);
      const rate = input.costCurrency === "USD" ? input.exchangeRate! : null;
      const landed = input.landedCostMvr ?? (input.costCurrency === "USD" ? input.supplierCost * input.exchangeRate! : input.supplierCost);
      const balance = await productBalance(tx, input.productId, input.variantKey ?? null);
      // Product locking serializes same-product receipts. Re-check after waiting so
      // a concurrent identical request becomes a clean idempotent response.
      const existingAfterLock = inventoryResultRows(await tx.execute(sql`SELECT * FROM inventory_batches WHERE receipt_key = ${input.receiptKey}`))[0];
      if (existingAfterLock) {
        if (!receiptPayloadMatches(existingAfterLock, input, sup.id)) fail("Receipt key was already used for a different receipt", 409);
        return { batch: existingAfterLock, idempotent: true };
      }
      const after = balance.before + input.quantity;
      const updatedMap = { ...balance.map };
      if (input.variantKey !== undefined && input.variantKey !== null) updatedMap[input.variantKey] = after;
      const batch = inventoryResultRows(await tx.execute(sql`
        INSERT INTO inventory_batches
          (product_id, variant_key, supplier_id, arrived_at, quantity_received, quantity_remaining, supplier_cost, cost_currency, exchange_rate, unit_landed_cost_mvr, reference, receipt_key, created_by)
        VALUES (${input.productId}, ${input.variantKey ?? null}, ${sup.id},
          COALESCE(${input.arrivedAt ? `${input.arrivedAt}T00:00:00.000Z` : null}::timestamptz, now()),
          ${input.quantity}, ${input.quantity}, ${input.supplierCost}, ${input.costCurrency}, ${rate}, ${landed}, ${input.reference ?? null}, ${input.receiptKey}, ${admin.id})
          ON CONFLICT (receipt_key) DO NOTHING
        RETURNING *`))[0];
      if (!batch) {
        const conflicted = inventoryResultRows(await tx.execute(sql`SELECT * FROM inventory_batches WHERE receipt_key = ${input.receiptKey}`))[0];
        const conflictedSupplierId = await supplierIdForExisting(tx, input);
        if (!conflicted || !conflictedSupplierId || !receiptPayloadMatches(conflicted, input, conflictedSupplierId))
          fail("Receipt key was already used for a different receipt", 409);
        return { batch: conflicted, idempotent: true };
      }
      await tx.execute(input.variantKey ? sql`UPDATE products SET variant_stock = ${JSON.stringify(updatedMap)}::jsonb WHERE id = ${input.productId}` :
        sql`UPDATE products SET stock = ${after} WHERE id = ${input.productId}`);
      await tx.execute(sql`INSERT INTO inventory_movements
        (product_id, variant_key, quantity_delta, quantity_before, quantity_after, kind, reason, batch_id, reference, actor_id)
        VALUES (${input.productId}, ${input.variantKey ?? null}, ${input.quantity}, ${balance.before}, ${after}, 'receipt', 'Inventory receipt', ${batch.id}, ${input.reference ?? null}, ${admin.id})`);
      await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
        VALUES (${admin.id}, 'inventory_batch', ${batch.id}, 'receipt', 'Inventory receipt', ${JSON.stringify({ productId: input.productId, variantKey: input.variantKey ?? null, quantity: input.quantity, landedCostMvr: landed, arrivedAt: input.arrivedAt ?? null })}::jsonb)`);
      return { batch, idempotent: false };
    });
    res.status(result.idempotent ? 200 : 201).json(result);
  }));
  app.post("/api/admin/inventory/bulk-adjustments", handle(async (req, res) => {
    const admin = await operator(req, getDb(), true);
    const parsed = validateBulkAdjustmentInput(req.body);
    if (!parsed.success) fail("Check adjustment reason, expected balances and rows");
    const input = parsed.data;
    const result = await transaction(getDb(), async tx => {
      const unique = Array.from(new Set(input.rows.map(row => row.productId))).sort();
      const locked = new Map<string, any>();
      for (const id of unique) {
        const row = inventoryResultRows(await tx.execute(sql`SELECT id, stock, variant_stock FROM products WHERE id = ${id} FOR UPDATE`))[0];
        if (!row) fail("Product not found", 404);
        locked.set(id, row);
      }
      const changes: any[] = [];
      for (const rowInput of input.rows) {
        const row = locked.get(rowInput.productId);
        const key = rowInput.variantKey ?? null;
        const map = row.variant_stock && typeof row.variant_stock === "object" ? { ...row.variant_stock } : {};
        if (key !== null && map[key] === undefined) fail("Inventory variant is not available");
        const before = key === null ? Number(row.stock || 0) : Number(map[key] || 0);
        const target = rowInput.targetBalance ?? before + rowInput.delta!;
        if (before !== rowInput.expectedBalance) fail("Inventory changed since the expected balance was read", 409);
        if (!Number.isSafeInteger(target) || target < 0) fail("Adjustment would create a negative balance");
        const delta = target - before;
        if (!delta) continue;
        if (key === null) row.stock = target; else map[key] = target;
        row.variant_stock = map;
        changes.push({ ...rowInput, before, target, delta, tracked: false });
        if (delta < 0) {
          let remaining = -delta;
          const batches = inventoryResultRows(await tx.execute(sql`
            SELECT id, quantity_remaining FROM inventory_batches
            WHERE product_id = ${rowInput.productId} AND (${key} IS NULL OR variant_key = ${key}) AND quantity_remaining > 0
            ORDER BY arrived_at ASC, id ASC FOR UPDATE`));
          for (const batch of batches) {
            if (!remaining) break;
            const take = Math.min(remaining, Number(batch.quantity_remaining));
            await tx.execute(sql`UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ${take} WHERE id = ${batch.id}`);
            remaining -= take;
            changes[changes.length - 1].tracked = true;
          }
        }
      }
      for (const id of unique) {
        const row = locked.get(id);
        await tx.execute(sql`UPDATE products SET stock = ${row.stock}, variant_stock = ${JSON.stringify(row.variant_stock || {})}::jsonb WHERE id = ${id}`);
      }
      for (const change of changes) {
        const movement = inventoryResultRows(await tx.execute(sql`
          INSERT INTO inventory_movements
            (product_id, variant_key, quantity_delta, quantity_before, quantity_after, kind, reason, reference, actor_id)
          VALUES (${change.productId}, ${change.variantKey ?? null}, ${change.delta}, ${change.before}, ${change.target}, 'adjustment', ${input.reason}, ${input.reference ?? null}, ${admin.id})
          RETURNING *`))[0];
        await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
          VALUES (${admin.id}, 'inventory', ${change.productId}, 'bulk_adjustment', ${input.reason},
            ${JSON.stringify({ variantKey: change.variantKey ?? null, before: change.before, after: change.target, delta: change.delta, batchCostTracked: change.tracked })}::jsonb)`);
        change.movement = movement;
      }
      return changes;
    });
    res.status(201).json({ changes: result });
  }));
}