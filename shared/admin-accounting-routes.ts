import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { securityRows } from "./admin-security.js";

type Database = {
  execute: (query: any) => Promise<any>;
  transaction: <T>(callback: (tx: { execute: (query: any) => Promise<any> }) => Promise<T>) => Promise<T>;
};
type AdminRequest = Request & { res: Response };

const id = z.string().uuid();
const money = z.number().finite().min(0).max(100000000000);
const date = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const currency = z.enum(["MVR", "USD"]);

const settingsInput = z.object({
  taxEnabled: z.boolean(),
  gstRate: z.number().finite().min(0).max(100),
  tgstRate: z.number().finite().min(0).max(100),
  // The administrator must explicitly set the rate.  A missing setting is
  // handled by the read route, but null is never a valid write.
  usdToMvrRate: z.number().finite().positive().max(1000000),
  costingMethod: z.enum(["FIFO", "AVERAGE"]),
}).strict();

const variantInput = z.object({
  variantKey: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).nullable().optional(),
  usdPrice: money.nullable().optional(),
  wholesaleCostMvr: money.nullable().optional(),
  supplierCostMvr: money.nullable().optional(),
}).strict();

const productDetailsInput = z.object({
  weightKg: money.nullable().optional(),
  lengthCm: money.nullable().optional(),
  widthCm: money.nullable().optional(),
  heightCm: money.nullable().optional(),
  wholesaleCostMvr: money.nullable().optional(),
  supplierCostMvr: money.nullable().optional(),
  variants: z.array(variantInput).max(100).default([]),
}).strict();

const expenseInput = z.object({
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  amount: money.refine(value => value > 0, "Amount must be greater than zero"),
  currency,
  usdToMvrRate: z.number().finite().positive().max(1000000).nullable().optional(),
  isLanded: z.boolean().default(false),
  batchId: id.nullable().optional(),
  supplierId: id.nullable().optional(),
  expenseDate: date,
}).strict();

function rows(result: any): any[] { return securityRows(result); }
function actor(req: Request): string {
  const value = (req.res?.locals as any)?.admin?.id;
  if (typeof value !== "string" || !value) throw Object.assign(new Error("Admin session required"), { status: 401 });
  return value;
}
function fail(res: Response, error: any, fallback = "Accounting request could not be completed.") {
  const status = error?.status === 404 ? 404 : error?.status === 409 ? 409 : error?.status === 403 ? 403 : error?.status === 400 ? 400 : 503;
  res.status(status).json({ message: status === 503 ? fallback : String(error.message || fallback) });
}
function numeric(value: any): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const OPEN_REDOTPAY_STATES = new Set(["creating", "unknown", "pending"]);

/** Native USD receivable shaping for RedotPay payment snapshots. */
export function redotPayUsdMetrics(payments: Array<{ state: string; usdCents: number }>) {
  return payments.reduce((result, payment) => {
    const cents = Number(payment.usdCents);
    if (!Number.isFinite(cents) || cents < 0) return result;
    if (OPEN_REDOTPAY_STATES.has(payment.state)) result.openUsd += cents / 100;
    if (payment.state === "paid") result.verifiedReceiptsUsd += cents / 100;
    return result;
  }, { openUsd: 0, verifiedReceiptsUsd: 0 });
}

/** Pure report shaping helper, also useful to keep CSV/API semantics identical. */
export function accountingReportSummary(input: {
  gst: Array<{ taxType: string; taxableBaseMvr: number; taxAmountMvr: number }>;
  tenders: Array<{ currency: string; amountMvr: number; amount: number }>;
  cogs: Array<{ confidence: string; totalCostMvr: number }>;
  expenses: Array<{ amountMvr: number; fee?: boolean }>;
  landedCostMvr?: number;
  eligiblePosLines?: number;
  uncoveredPosLines?: number;
  estimatedPosLines?: number;
  knownPosLines?: number;
  eligibleManualLines?: number;
  uncoveredManualLines?: number;
  estimatedManualLines?: number;
  knownManualLines?: number;
  bookedOrdersMvr: number;
  collectedMvr: number;
  manualCollectedMvr?: number;
  convertedPosOrdersMvr?: number;
  realizedFxMvr?: number;
  /** Open balances are deliberately native-currency buckets, never converted
   * and added together.  `unverified` describes legacy MVR order status data
   * which has no receipt ledger. */
  openReceivables?: { MVR?: number; USD?: number; unverifiedMvr?: number };
  verifiedRedotPayReceiptsUsd?: number;
}) {
  const gst = { GST: { taxableBaseMvr: 0, taxAmountMvr: 0 }, TGST: { taxableBaseMvr: 0, taxAmountMvr: 0 } };
  for (const row of input.gst) {
    if (row.taxType === "GST" || row.taxType === "TGST") {
      gst[row.taxType].taxableBaseMvr += Number(row.taxableBaseMvr) || 0;
      gst[row.taxType].taxAmountMvr += Number(row.taxAmountMvr) || 0;
    }
  }
  const tenderCurrencies = { MVR: { amount: 0, amountMvr: 0 }, USD: { amount: 0, amountMvr: 0 } };
  for (const row of input.tenders) {
    if (row.currency === "MVR" || row.currency === "USD") {
      tenderCurrencies[row.currency].amount += Number(row.amount) || 0;
      tenderCurrencies[row.currency].amountMvr += Number(row.amountMvr) || 0;
    }
  }
  const cogs = { knownMvr: 0, estimatedMvr: 0, historicalUnknownMvr: 0 };
  for (const row of input.cogs) {
    if (row.confidence === "known") cogs.knownMvr += Number(row.totalCostMvr) || 0;
    else if (row.confidence === "estimated") cogs.estimatedMvr += Number(row.totalCostMvr) || 0;
    else cogs.historicalUnknownMvr += Number(row.totalCostMvr) || 0;
  }
  const overheadMvr = input.expenses.reduce((sum, row) => sum + (Number(row.amountMvr) || 0), 0);
  const landedCostMvr = input.landedCostMvr ?? 0;
  const eligiblePosLines = input.eligiblePosLines ?? 0;
  const uncoveredPosLines = input.uncoveredPosLines ?? 0;
  const estimatedPosLines = input.estimatedPosLines ?? 0;
  const knownPosLines = input.knownPosLines ?? 0;
  const eligibleManualLines = input.eligibleManualLines ?? 0;
  const uncoveredManualLines = input.uncoveredManualLines ?? 0;
  const estimatedManualLines = input.estimatedManualLines ?? 0;
  const knownManualLines = input.knownManualLines ?? 0;
  // Every eligible POS line must have a known COGS posting. A report with no
  // COGS rows must never look complete merely because its summed unknown cost
  // happens to be zero.
  const completeCostCoverage = uncoveredPosLines === 0 && estimatedPosLines === 0 &&
    uncoveredManualLines === 0 && estimatedManualLines === 0 &&
    cogs.historicalUnknownMvr === 0 &&
    (eligiblePosLines === 0 || knownPosLines === eligiblePosLines) &&
    (eligibleManualLines === 0 || knownManualLines === eligibleManualLines);
  const taxLiabilityMvr = gst.GST.taxAmountMvr + gst.TGST.taxAmountMvr;
  const realizedFxMvr = input.realizedFxMvr ?? 0;
  const manualCollectedMvr = input.manualCollectedMvr ?? 0;
  const openReceivables = {
    MVR: Number(input.openReceivables?.MVR) || 0,
    USD: Number(input.openReceivables?.USD) || 0,
  };
  const unverifiedOpenMvr = Number(input.openReceivables?.unverifiedMvr ?? openReceivables.MVR) || 0;
  const verifiedRedotPayReceiptsUsd = Number(input.verifiedRedotPayReceiptsUsd) || 0;
  return {
    bookedOrdersMvr: input.bookedOrdersMvr,
    collectedMvr: input.collectedMvr,
    manualCollectedMvr,
    offlineCollectedMvr: input.collectedMvr + manualCollectedMvr,
    // Kept separate so a POS transaction converted to an order is never
    // silently counted as both booked web value and collected POS value.
    convertedPosOrdersMvr: input.convertedPosOrdersMvr ?? 0,
    realizedFxMvr,
    // These are not an MVR balance: USD is intentionally not converted or
    // included in the MVR figure.
    openReceivables,
    unverifiedOpenMvr,
    verifiedRedotPayReceiptsUsd,
    gst, taxLiabilityMvr, tenderCurrencies, cogs, overheadMvr, landedCostMvr,
    eligiblePosLines, uncoveredPosLines, estimatedPosLines, knownPosLines,
    eligibleManualLines, uncoveredManualLines, estimatedManualLines, knownManualLines,
    completeCostCoverage,
    // POS operating result excludes GST/TGST liability; it is not all-business net profit.
    posOperatingResultMvr: completeCostCoverage ? input.collectedMvr - taxLiabilityMvr + realizedFxMvr - cogs.knownMvr - overheadMvr : null,
    offlineOperatingResultMvr: completeCostCoverage ? input.collectedMvr + manualCollectedMvr - taxLiabilityMvr + realizedFxMvr - cogs.knownMvr - overheadMvr : null,
  };
}

/** Realized only when an operator records a settlement valuation. */
export function calculateRealizedFxMvr(usdTenders: Array<{ amount: number; bookedRate: number }>, settlementRate: number): number {
  if (!Number.isFinite(settlementRate) || settlementRate <= 0) throw new Error("Settlement rate must be positive");
  return Math.round(usdTenders.reduce((sum, tender) => {
    if (!Number.isFinite(tender.amount) || tender.amount < 0 || !Number.isFinite(tender.bookedRate) || tender.bookedRate <= 0)
      throw new Error("USD tender booking is invalid");
    return sum + tender.amount * (settlementRate - tender.bookedRate);
  }, 0) * 10000) / 10000;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export type TaxExportRow = {
  source: "POS" | "MANUAL";
  invoiceRef: string;
  recordedAt: string | Date;
  saleId: string;
  status: string;
  taxType: string;
  taxableBaseMvr: number;
  appliedRate: number;
  taxAmountMvr: number;
  grossMvr: number;
  discountMvr: number;
  netMvr: number;
  paymentMethod: string;
  paymentCurrency: string;
  usdToMvrRate: number | null;
  paymentReference: string;
};

/** MRA review worksheet only; this is not an official regulator upload format. */
export function taxExportCsv(records: TaxExportRow[]): string {
  const header = [
    "Source", "Invoice reference", "Recorded date/time", "Sale ID", "Status", "Tax type",
    "Taxable base MVR", "Applied rate (%)", "Tax amount MVR", "Gross MVR",
    "Discount MVR", "Net MVR", "Payment method", "Payment currency",
    "Manual USD/MVR rate", "Payment reference",
  ];
  const body = records.map(record => [
    record.source, record.invoiceRef, record.recordedAt instanceof Date ? record.recordedAt.toISOString() : record.recordedAt,
    record.saleId, record.status, record.taxType, record.taxableBaseMvr, record.appliedRate,
    record.taxAmountMvr, record.grossMvr, record.discountMvr, record.netMvr, record.paymentMethod,
    record.paymentCurrency, record.usdToMvrRate, record.paymentReference,
  ]);
  return [header, ...body].map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function registerAdminAccountingRoutes(app: Express, getDb: () => Database) {
  const handle = (fn: (req: AdminRequest, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try { await fn(req as AdminRequest, res); } catch (error) { fail(res, error); }
    };

  app.get("/api/admin/accounting/settings", handle(async (_req, res) => {
    const record = rows(await getDb().execute(sql`
      SELECT id, tax_enabled AS "taxEnabled", gst_rate::float8 AS "gstRate",
        tgst_rate::float8 AS "tgstRate", usd_to_mvr_rate::float8 AS "usdToMvrRate",
        costing_method AS "costingMethod", updated_by AS "updatedBy", updated_at AS "updatedAt"
      FROM accounting_settings WHERE id = 1`))[0];
    res.json(record ? { ...record, usdToMvrRate: numeric(record.usdToMvrRate) ?? 15.42 } :
      { id: 1, taxEnabled: false, gstRate: 0, tgstRate: 0, usdToMvrRate: 15.42, costingMethod: "FIFO", updatedBy: null, updatedAt: null });
  }));

  app.put("/api/admin/accounting/settings", handle(async (req, res) => {
    const input = settingsInput.safeParse(req.body);
    if (!input.success) throw Object.assign(new Error("Check tax rates, exchange rate, and costing method."), { status: 400 });
    const adminId = actor(req);
    const db = getDb();
    const record = rows(await db.execute(sql`
      INSERT INTO accounting_settings (id, tax_enabled, gst_rate, tgst_rate, usd_to_mvr_rate, costing_method, updated_by, updated_at)
      VALUES (1, ${input.data.taxEnabled}, ${input.data.gstRate}, ${input.data.tgstRate}, ${input.data.usdToMvrRate}, ${input.data.costingMethod}, ${adminId}, now())
      ON CONFLICT (id) DO UPDATE SET tax_enabled = EXCLUDED.tax_enabled, gst_rate = EXCLUDED.gst_rate,
        tgst_rate = EXCLUDED.tgst_rate, usd_to_mvr_rate = EXCLUDED.usd_to_mvr_rate,
        costing_method = EXCLUDED.costing_method, updated_by = EXCLUDED.updated_by, updated_at = now()
      RETURNING id, tax_enabled AS "taxEnabled", gst_rate::float8 AS "gstRate",
        tgst_rate::float8 AS "tgstRate", usd_to_mvr_rate::float8 AS "usdToMvrRate",
        costing_method AS "costingMethod", updated_by AS "updatedBy", updated_at AS "updatedAt"`))[0];
    await db.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
      VALUES (${adminId}, 'accounting_settings', '1', 'update', 'Accounting settings changed', ${JSON.stringify(input.data)}::jsonb)`);
    res.json(record);
  }));

  app.get("/api/admin/product-details/:productId", handle(async (req, res) => {
    if (!id.safeParse(req.params.productId).success) throw Object.assign(new Error("Invalid product ID"), { status: 400 });
    const db = getDb();
    const product = rows(await db.execute(sql`SELECT id FROM products WHERE id = ${req.params.productId}`))[0];
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
    const details = rows(await db.execute(sql`SELECT product_id AS "productId", weight_kg::float8 AS "weightKg",
      length_cm::float8 AS "lengthCm", width_cm::float8 AS "widthCm", height_cm::float8 AS "heightCm",
      wholesale_cost_mvr::float8 AS "wholesaleCostMvr", supplier_cost_mvr::float8 AS "supplierCostMvr"
      FROM admin_product_details WHERE product_id = ${req.params.productId}`))[0] || {
        productId: req.params.productId,
        weightKg: null,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        wholesaleCostMvr: null,
        supplierCostMvr: null,
      };
    details.variants = rows(await db.execute(sql`SELECT product_id AS "productId", variant_key AS "variantKey",
      sku, usd_price::float8 AS "usdPrice", wholesale_cost_mvr::float8 AS "wholesaleCostMvr",
      supplier_cost_mvr::float8 AS "supplierCostMvr" FROM product_variant_commercial WHERE product_id = ${req.params.productId} ORDER BY variant_key`));
    res.json(details);
  }));

  app.put("/api/admin/product-details/:productId", handle(async (req, res) => {
    const productId = req.params.productId;
    if (!id.safeParse(productId).success) throw Object.assign(new Error("Invalid product ID"), { status: 400 });
    const input = productDetailsInput.safeParse(req.body);
    if (!input.success) throw Object.assign(new Error("Check product dimensions, costs, and variant metadata."), { status: 400 });
    const db = getDb(); const adminId = actor(req);
    const product = rows(await db.execute(sql`SELECT id, variant_stock AS "variantStock", variants, colors FROM products WHERE id = ${productId}`))[0];
    if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
    const persistedKeys = product.variantStock && typeof product.variantStock === "object" && !Array.isArray(product.variantStock)
      ? Object.keys(product.variantStock) : [];
    const hasDeclaredVariants = (Array.isArray(product.variants) && product.variants.some((v: any) => v?.size && v.size !== "Standard"))
      || (Array.isArray(product.colors) && product.colors.length > 0);
    const known = new Set<string>(persistedKeys.length ? persistedKeys : (hasDeclaredVariants ? [] : ["Standard-Default"]));
    if (!persistedKeys.length && hasDeclaredVariants)
      throw Object.assign(new Error("Product variant stock keys are missing; metadata cannot be safely saved."), { status: 409 });
    if (!persistedKeys.length && input.data.variants.some(v => v.variantKey !== "Standard-Default"))
      throw Object.assign(new Error("Variant metadata must match persisted product stock keys."), { status: 400 });
    if (input.data.variants.some(v => !known.has(v.variantKey))) throw Object.assign(new Error("Variant metadata must match a current product variant."), { status: 400 });
    if (new Set(input.data.variants.map(v => v.sku).filter(Boolean)).size !== input.data.variants.filter(v => v.sku).length) throw Object.assign(new Error("Variant SKUs must be unique."), { status: 400 });
    const submittedSkus = input.data.variants.map(v => v.sku).filter((value): value is string => !!value);
    if (submittedSkus.length) {
      const conflict = rows(await db.execute(sql`SELECT sku FROM product_variant_commercial
        WHERE sku = ANY(${submittedSkus}) AND product_id <> ${productId} LIMIT 1`))[0];
      if (conflict) throw Object.assign(new Error("Variant SKU already belongs to another product."), { status: 409 });
    }
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`INSERT INTO admin_product_details (product_id, weight_kg, length_cm, width_cm, height_cm, wholesale_cost_mvr, supplier_cost_mvr)
        VALUES (${productId}, ${input.data.weightKg ?? null}, ${input.data.lengthCm ?? null}, ${input.data.widthCm ?? null}, ${input.data.heightCm ?? null}, ${input.data.wholesaleCostMvr ?? null}, ${input.data.supplierCostMvr ?? null})
        ON CONFLICT (product_id) DO UPDATE SET weight_kg=EXCLUDED.weight_kg, length_cm=EXCLUDED.length_cm, width_cm=EXCLUDED.width_cm, height_cm=EXCLUDED.height_cm, wholesale_cost_mvr=EXCLUDED.wholesale_cost_mvr, supplier_cost_mvr=EXCLUDED.supplier_cost_mvr`);
      for (const variant of input.data.variants) await tx.execute(sql`INSERT INTO product_variant_commercial (product_id, variant_key, sku, usd_price, wholesale_cost_mvr, supplier_cost_mvr)
        VALUES (${productId}, ${variant.variantKey}, ${variant.sku ?? null}, ${variant.usdPrice ?? null}, ${variant.wholesaleCostMvr ?? null}, ${variant.supplierCostMvr ?? null})
        ON CONFLICT (product_id, variant_key) DO UPDATE SET sku=EXCLUDED.sku, usd_price=EXCLUDED.usd_price, wholesale_cost_mvr=EXCLUDED.wholesale_cost_mvr, supplier_cost_mvr=EXCLUDED.supplier_cost_mvr`);
      await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
        VALUES (${adminId}, 'product_details', ${productId}, 'update', 'Product accounting metadata changed', ${JSON.stringify(input.data)}::jsonb)`);
    });
    res.json({ productId, ...input.data });
  }));

  app.get("/api/admin/accounting/expenses", handle(async (_req, res) => {
    res.json(rows(await getDb().execute(sql`SELECT id, category, description, amount::float8 AS amount,
      currency, usd_to_mvr_rate::float8 AS "usdToMvrRate", amount_mvr::float8 AS "amountMvr",
      is_landed AS "isLanded", batch_id AS "batchId", supplier_id AS "supplierId",
      expense_date AS "expenseDate", actor_id AS "actorId", created_at AS "createdAt"
      FROM expenses ORDER BY expense_date DESC, created_at DESC`)));
  }));

  app.post("/api/admin/accounting/expenses", handle(async (req, res) => {
    const input = expenseInput.safeParse(req.body);
    if (!input.success || (input.success && input.data.currency === "USD" && !input.data.usdToMvrRate))
      throw Object.assign(new Error("USD expenses require a manual exchange rate."), { status: 400 });
    const adminId = actor(req); const data = input.data;
    const amountMvr = data.currency === "USD" ? data.amount * (data.usdToMvrRate as number) : data.amount;
    if (data.isLanded && !data.batchId) throw Object.assign(new Error("Landed expense must reference an inventory batch."), { status: 400 });
    const db = getDb();
    const expense = await db.transaction(async (tx: any) => {
      let batch: any;
      if (data.isLanded) {
        batch = rows(await tx.execute(sql`SELECT id, quantity_received AS "quantityReceived",
          quantity_remaining AS "quantityRemaining", unit_landed_cost_mvr AS "unitLandedCostMvr"
          FROM inventory_batches WHERE id = ${data.batchId} FOR UPDATE`))[0];
        if (!batch) throw Object.assign(new Error("Inventory batch not found."), { status: 404 });
        if (Number(batch.quantityRemaining) !== Number(batch.quantityReceived))
          throw Object.assign(new Error("Landed cost cannot be added after a batch has been consumed."), { status: 409 });
        const quantity = Number(batch.quantityReceived);
        if (!(quantity > 0)) throw Object.assign(new Error("Inventory batch quantity is invalid."), { status: 409 });
        const updatedCost = Number(batch.unitLandedCostMvr) + amountMvr / quantity;
        await tx.execute(sql`UPDATE inventory_batches SET unit_landed_cost_mvr = ${updatedCost}
          WHERE id = ${data.batchId}`);
      }
      const inserted = rows(await tx.execute(sql`INSERT INTO expenses
        (category, description, amount, currency, usd_to_mvr_rate, amount_mvr, is_landed, batch_id, supplier_id, expense_date, actor_id)
        VALUES (${data.category}, ${data.description}, ${data.amount}, ${data.currency}, ${data.usdToMvrRate ?? null}, ${amountMvr}, ${data.isLanded}, ${data.batchId ?? null}, ${data.supplierId ?? null}, ${data.expenseDate}, ${adminId})
        RETURNING id, category, description, amount::float8 AS amount, currency, usd_to_mvr_rate::float8 AS "usdToMvrRate", amount_mvr::float8 AS "amountMvr", is_landed AS "isLanded", batch_id AS "batchId", supplier_id AS "supplierId", expense_date AS "expenseDate", actor_id AS "actorId", created_at AS "createdAt"`))[0];
      await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
        VALUES (${adminId}, 'expense', ${inserted.id}, 'create', 'Expense recorded', ${JSON.stringify(data)}::jsonb)`);
      return inserted;
    });
    res.status(201).json(expense);
  }));

  app.post("/api/admin/accounting/pos/:id/fx-settlement", handle(async (req, res) => {
    const posId = req.params.id;
    if (!id.safeParse(posId).success) throw Object.assign(new Error("Invalid POS transaction ID."), { status: 400 });
    const rate = req.body?.settlementRate;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1000000 || !reason || reason.length > 500)
      throw Object.assign(new Error("A positive settlement rate and operator reason are required."), { status: 400 });
    const adminId = actor(req);
    const result = await getDb().transaction(async (tx: any) => {
      const pos = rows(await tx.execute(sql`SELECT id, status, converted_to_order_id AS "convertedToOrderId"
        FROM pos_transactions WHERE id = ${posId} FOR UPDATE`))[0];
      if (!pos) throw Object.assign(new Error("POS transaction not found."), { status: 404 });
      if (pos.status !== "completed" || pos.convertedToOrderId)
        throw Object.assign(new Error("Only completed, unconverted POS transactions may be settled."), { status: 409 });
      const already = rows(await tx.execute(sql`SELECT id FROM accounting_audit
        WHERE entity_kind = 'pos_fx_settlement' AND entity_id = ${posId} AND action = 'create' LIMIT 1`))[0];
      if (already) throw Object.assign(new Error("FX settlement has already been recorded for this POS transaction."), { status: 409 });
      const tenders = rows(await tx.execute(sql`SELECT amount::float8 AS amount, usd_to_mvr_rate::float8 AS "bookedRate"
        FROM pos_payment_lines WHERE pos_id = ${posId} AND currency = 'USD' FOR UPDATE`));
      if (!tenders.length) throw Object.assign(new Error("POS transaction has no USD tender to settle."), { status: 400 });
      const variance = calculateRealizedFxMvr(tenders, rate);
      const accounting = rows(await tx.execute(sql`INSERT INTO pos_accounting
        (pos_id, tax_type, taxable_base_mvr, tax_rate, tax_amount_mvr, fx_variance_mvr)
        VALUES (${posId}, 'NONE', 0, 0, 0, ${variance})
        ON CONFLICT (pos_id) DO UPDATE SET fx_variance_mvr = ${variance}
        RETURNING pos_id AS "posId", fx_variance_mvr::float8 AS "realizedFxMvr"`))[0];
      await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
        VALUES (${adminId}, 'pos_fx_settlement', ${posId}, 'create', ${reason},
          ${JSON.stringify({ settlementRate: rate, realizedFxMvr: variance })}::jsonb)`);
      return accounting;
    });
    res.status(201).json(result);
  }));

  app.post("/api/admin/accounting/manual-orders/:id/fx-settlement", handle(async (req, res) => {
    const orderId = req.params.id;
    if (!id.safeParse(orderId).success) throw Object.assign(new Error("Invalid manual order ID."), { status: 400 });
    if ((req.res?.locals as any)?.admin?.isSuperAdmin !== true)
      throw Object.assign(new Error("Super-admin access required for manual-order FX settlement."), { status: 403 });
    const rate = req.body?.settlementRate;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1000000 || !reason || reason.length > 500)
      throw Object.assign(new Error("A positive settlement rate and operator reason are required."), { status: 400 });
    const adminId = actor(req);
    const result = await getDb().transaction(async (tx: any) => {
      const accounting = rows(await tx.execute(sql`SELECT a.order_id AS "orderId",
          o.status, o.payment_method AS "paymentMethod"
        FROM manual_order_accounting a JOIN orders o ON o.id = a.order_id
        WHERE a.order_id = ${orderId} FOR UPDATE`))[0];
      if (!accounting) throw Object.assign(new Error("Manual order accounting not found."), { status: 404 });
      if (!["confirmed", "paid", "completed"].includes(accounting.status) || ["cancelled", "refunded"].includes(accounting.status))
        throw Object.assign(new Error("Only paid, non-cancelled manual orders may be settled."), { status: 409 });
      const already = rows(await tx.execute(sql`SELECT id FROM accounting_audit
        WHERE entity_kind = 'manual_order_fx_settlement' AND entity_id = ${orderId} AND action = 'create' LIMIT 1`))[0];
      // The column defaults to zero for every new manual order. Only the
      // audited settlement event distinguishes a settled order from a new one.
      if (already)
        throw Object.assign(new Error("FX settlement has already been recorded for this manual order."), { status: 409 });
      const tenders = rows(await tx.execute(sql`SELECT amount::float8 AS amount, usd_to_mvr_rate::float8 AS "bookedRate"
        FROM manual_order_payment_lines WHERE order_id = ${orderId} AND currency = 'USD' FOR UPDATE`));
      if (!tenders.length) throw Object.assign(new Error("Manual order has no USD tender to settle."), { status: 400 });
      const variance = calculateRealizedFxMvr(tenders, rate);
      await tx.execute(sql`UPDATE manual_order_accounting SET fx_variance_mvr = ${variance}
        WHERE order_id = ${orderId}`);
      await tx.execute(sql`INSERT INTO accounting_audit (actor_id, entity_kind, entity_id, action, reason, data)
        VALUES (${adminId}, 'manual_order_fx_settlement', ${orderId}, 'create', ${reason},
          ${JSON.stringify({ settlementRate: rate, realizedFxMvr: variance })}::jsonb)`);
      return { gainLossMvr: variance, realizedFxMvr: variance };
    });
    res.status(201).json(result);
  }));

  app.get("/api/admin/accounting/tax-export.csv", handle(async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "1970-01-01";
    const to = typeof req.query.to === "string" ? req.query.to : "2999-12-31";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      throw Object.assign(new Error("Use YYYY-MM-DD dates."), { status: 400 });
    const records = rows(await getDb().execute(sql`
      SELECT 'POS' AS source, p.transaction_number AS "invoiceRef", p.created_at AS "recordedAt", p.id::text AS "saleId",
        p.status, COALESCE(a.tax_type, 'NONE') AS "taxType",
        COALESCE(a.taxable_base_mvr, p.subtotal - COALESCE(p.discount, 0))::float8 AS "taxableBaseMvr",
        COALESCE(a.tax_rate, 0)::float8 AS "appliedRate",
        COALESCE(a.tax_amount_mvr, 0)::float8 AS "taxAmountMvr",
        p.total::float8 AS "grossMvr", COALESCE(p.discount, 0)::float8 AS "discountMvr",
        (p.total - COALESCE(a.tax_amount_mvr, 0))::float8 AS "netMvr",
        p.payment_method AS "paymentMethod",
        COALESCE(string_agg(DISTINCT l.currency, '; ' ORDER BY l.currency), 'MVR') AS "paymentCurrency",
        MAX(l.usd_to_mvr_rate)::float8 AS "usdToMvrRate",
        COALESCE(string_agg(DISTINCT l.reference, '; ' ORDER BY l.reference) FILTER (WHERE l.reference IS NOT NULL), '') AS "paymentReference"
      FROM pos_transactions p
      LEFT JOIN pos_accounting a ON a.pos_id = p.id
      LEFT JOIN pos_payment_lines l ON l.pos_id = p.id
      WHERE p.status NOT IN ('cancelled', 'refunded', 'reversed')
        AND p.converted_to_order_id IS NULL
        AND p.created_at::date BETWEEN ${from} AND ${to}
      GROUP BY p.id, p.transaction_number, p.created_at, p.status, a.tax_type,
        a.taxable_base_mvr, a.tax_rate, a.tax_amount_mvr, p.subtotal, p.discount,
        p.total, p.payment_method
      UNION ALL
      SELECT 'MANUAL' AS source, o.order_number AS "invoiceRef", a.recorded_at AS "recordedAt", o.id::text AS "saleId",
        o.status, a.tax_type AS "taxType", a.taxable_base_mvr::float8 AS "taxableBaseMvr",
        a.tax_rate::float8 AS "appliedRate", a.tax_amount_mvr::float8 AS "taxAmountMvr",
        o.total::float8 AS "grossMvr", COALESCE(o.discount, 0)::float8 AS "discountMvr",
        (o.total - a.tax_amount_mvr)::float8 AS "netMvr", o.payment_method AS "paymentMethod",
        COALESCE(string_agg(DISTINCT l.currency, '; ' ORDER BY l.currency), 'MVR') AS "paymentCurrency",
        MAX(l.usd_to_mvr_rate)::float8 AS "usdToMvrRate",
        COALESCE(string_agg(DISTINCT l.reference, '; ' ORDER BY l.reference) FILTER (WHERE l.reference IS NOT NULL), '') AS "paymentReference"
      FROM orders o
      JOIN manual_order_accounting a ON a.order_id = o.id
      LEFT JOIN manual_order_payment_lines l ON l.order_id = o.id
      WHERE o.status IN ('confirmed', 'paid', 'completed')
        AND o.status NOT IN ('cancelled', 'refunded')
        AND o.created_at::date BETWEEN ${from} AND ${to}
      GROUP BY o.id, o.order_number, a.recorded_at, o.status, a.tax_type,
        a.taxable_base_mvr, a.tax_rate, a.tax_amount_mvr, o.total, o.discount, o.payment_method
      ORDER BY "recordedAt", "invoiceRef"`));
    res.type("text/csv")
      .setHeader("X-Export-Notice", "MRA review worksheet; not an official regulator upload format")
      .setHeader("Content-Disposition", `attachment; filename="mra-review-worksheet-${from}-${to}.csv"`)
      .send(taxExportCsv(records));
  }));

  app.get("/api/admin/accounting/reports", handle(async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "1970-01-01";
    const to = typeof req.query.to === "string" ? req.query.to : "2999-12-31";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw Object.assign(new Error("Use YYYY-MM-DD dates."), { status: 400 });
    const db = getDb();
    const [gst, tenders, cogs, expenses, landed, coverage, totals, receivables] = await Promise.all([
      db.execute(sql`SELECT a.tax_type AS "taxType", SUM(a.taxable_base_mvr)::float8 AS "taxableBaseMvr", SUM(a.tax_amount_mvr)::float8 AS "taxAmountMvr"
        FROM pos_accounting a JOIN pos_transactions p ON p.id=a.pos_id WHERE p.status='completed' AND p.converted_to_order_id IS NULL AND p.created_at::date BETWEEN ${from} AND ${to} GROUP BY a.tax_type
        UNION ALL
        SELECT a.tax_type, SUM(a.taxable_base_mvr)::float8, SUM(a.tax_amount_mvr)::float8
        FROM manual_order_accounting a JOIN orders o ON o.id=a.order_id
        WHERE o.status IN ('confirmed', 'paid', 'completed') AND o.created_at::date BETWEEN ${from} AND ${to}
        GROUP BY a.tax_type`),
      db.execute(sql`SELECT l.currency, SUM(l.amount)::float8 AS amount, SUM(l.amount_mvr)::float8 AS "amountMvr"
        FROM pos_payment_lines l JOIN pos_transactions p ON p.id=l.pos_id WHERE p.status='completed' AND p.converted_to_order_id IS NULL AND p.created_at::date BETWEEN ${from} AND ${to} GROUP BY l.currency
        UNION ALL
        SELECT l.currency, SUM(l.amount)::float8, SUM(l.amount_mvr)::float8
        FROM manual_order_payment_lines l JOIN orders o ON o.id=l.order_id
        WHERE o.status IN ('confirmed', 'paid', 'completed') AND o.created_at::date BETWEEN ${from} AND ${to}
        GROUP BY l.currency`),
      db.execute(sql`SELECT c.confidence, SUM(c.total_cost_mvr)::float8 AS "totalCostMvr"
        FROM sale_cogs_lines c
        LEFT JOIN pos_transactions p ON c.sale_kind='POS' AND c.sale_id=p.id::text
        LEFT JOIN orders o ON c.sale_kind='ORDER' AND c.sale_id=o.id
        WHERE c.reversed_at IS NULL AND (
          (c.sale_kind='POS' AND p.status='completed' AND p.converted_to_order_id IS NULL AND p.created_at::date BETWEEN ${from} AND ${to})
          OR (c.sale_kind='ORDER' AND o.status IN ('confirmed', 'paid', 'completed')
            AND EXISTS (SELECT 1 FROM manual_order_accounting ma WHERE ma.order_id=o.id)
            AND o.created_at::date BETWEEN ${from} AND ${to})
        ) GROUP BY c.confidence`),
      db.execute(sql`SELECT amount_mvr::float8 AS "amountMvr", category FROM expenses WHERE NOT is_landed AND expense_date::date BETWEEN ${from} AND ${to}`),
      db.execute(sql`SELECT COALESCE(SUM(amount_mvr), 0)::float8 AS "landedCostMvr"
        FROM expenses WHERE is_landed AND expense_date::date BETWEEN ${from} AND ${to}`),
      db.execute(sql`
        WITH eligible_lines AS (
          SELECT 'POS' AS sale_kind, p.id::text AS sale_id, (line.ordinality - 1)::int AS line_index
          FROM pos_transactions p
          CROSS JOIN LATERAL jsonb_array_elements(p.items) WITH ORDINALITY AS line(item, ordinality)
          WHERE p.status = 'completed' AND p.converted_to_order_id IS NULL
            AND p.created_at::date BETWEEN ${from} AND ${to}
          UNION ALL
          SELECT 'ORDER' AS sale_kind, o.id::text AS sale_id, (line.ordinality - 1)::int AS line_index
          FROM orders o
          JOIN manual_order_accounting ma ON ma.order_id = o.id
          CROSS JOIN LATERAL jsonb_array_elements(o.items) WITH ORDINALITY AS line(item, ordinality)
          WHERE o.status IN ('confirmed', 'paid', 'completed')
            AND o.created_at::date BETWEEN ${from} AND ${to}
        ),
        line_costs AS (
          SELECT e.sale_kind, e.sale_id, e.line_index, COUNT(c.id)::int AS posting_count,
            BOOL_AND(c.confidence = 'known') AS all_known,
            BOOL_OR(c.confidence = 'estimated') AS has_estimated,
            BOOL_OR(c.confidence = 'historical_unknown') AS has_unknown
          FROM eligible_lines e
          LEFT JOIN sale_cogs_lines c
            ON c.sale_kind = e.sale_kind AND c.sale_id = e.sale_id
           AND c.line_index = e.line_index AND c.reversed_at IS NULL
          GROUP BY e.sale_kind, e.sale_id, e.line_index
        )
        SELECT COUNT(*) FILTER (WHERE sale_kind = 'POS')::int AS "eligiblePosLines",
          COUNT(*) FILTER (WHERE sale_kind = 'POS' AND (posting_count = 0 OR has_unknown))::int AS "uncoveredPosLines",
          COUNT(*) FILTER (WHERE sale_kind = 'POS' AND posting_count > 0 AND has_estimated AND NOT has_unknown)::int AS "estimatedPosLines",
          COUNT(*) FILTER (WHERE sale_kind = 'POS' AND posting_count > 0 AND all_known)::int AS "knownPosLines",
          COUNT(*) FILTER (WHERE sale_kind = 'ORDER')::int AS "eligibleManualLines",
          COUNT(*) FILTER (WHERE sale_kind = 'ORDER' AND (posting_count = 0 OR has_unknown))::int AS "uncoveredManualLines",
          COUNT(*) FILTER (WHERE sale_kind = 'ORDER' AND posting_count > 0 AND has_estimated AND NOT has_unknown)::int AS "estimatedManualLines",
          COUNT(*) FILTER (WHERE sale_kind = 'ORDER' AND posting_count > 0 AND all_known)::int AS "knownManualLines"
        FROM line_costs`),
      db.execute(sql`SELECT
        (SELECT COALESCE(SUM(o.total), 0)::float8
           FROM orders o
          WHERE o.status NOT IN ('cancelled', 'refunded')
            AND o.created_at::date BETWEEN ${from} AND ${to}
            AND NOT EXISTS (
              SELECT 1 FROM pos_transactions converted
               WHERE converted.converted_to_order_id = o.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM manual_order_accounting manual
               WHERE manual.order_id = o.id
            )) AS "bookedOrdersMvr",
        (SELECT COALESCE(SUM(p.total), 0)::float8
           FROM pos_transactions p
          WHERE p.status='completed' AND p.converted_to_order_id IS NULL
            AND p.created_at::date BETWEEN ${from} AND ${to}) AS "collectedMvr",
        (SELECT COALESCE(SUM(l.amount_mvr), 0)::float8
           FROM manual_order_payment_lines l
           JOIN orders o ON o.id = l.order_id
          WHERE o.status IN ('confirmed', 'paid', 'completed')
            AND o.created_at::date BETWEEN ${from} AND ${to}) AS "manualCollectedMvr",
        (SELECT COALESCE(SUM(o.total), 0)::float8
           FROM orders o
          WHERE o.status NOT IN ('cancelled', 'refunded')
            AND o.created_at::date BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM pos_transactions converted
               WHERE converted.converted_to_order_id = o.id
            )) AS "convertedPosOrdersMvr"`),
       // Receivables use native buckets.  In particular, never use the
       // accounting FX conversion to turn an open USD order into MVR.
       db.execute(sql`
         SELECT
           COALESCE(SUM(CASE WHEN o.payment_method = 'redotpay'
             AND rp.state IN ('creating', 'unknown', 'pending')
             THEN rp.usd_cents / 100.0 ELSE 0 END), 0)::float8 AS "openUsd",
           COALESCE(SUM(CASE WHEN o.payment_method <> 'redotpay'
             AND o.status NOT IN ('paid', 'completed')
             AND NOT EXISTS (
               SELECT 1 FROM manual_order_accounting manual
               WHERE manual.order_id = o.id
             )
             THEN o.total ELSE 0 END), 0)::float8 AS "openMvr",
           COALESCE(SUM(CASE WHEN o.payment_method = 'redotpay' AND rp.state = 'paid'
             THEN rp.usd_cents / 100.0 ELSE 0 END), 0)::float8 AS "verifiedRedotPayReceiptsUsd"
         FROM orders o
         LEFT JOIN redotpay_payments rp ON rp.order_id = o.id
         WHERE o.status NOT IN ('cancelled', 'refunded')
           AND NOT EXISTS (
             SELECT 1 FROM pos_transactions converted
             WHERE converted.converted_to_order_id = o.id
           )
           AND o.created_at::date BETWEEN ${from} AND ${to}`),
    ]);
    const totalsRow = rows(totals)[0] || {};
    const summary = accountingReportSummary({
      gst: rows(gst), tenders: rows(tenders), cogs: rows(cogs), expenses: rows(expenses),
      landedCostMvr: Number(rows(landed)[0]?.landedCostMvr || 0),
      eligiblePosLines: Number(rows(coverage)[0]?.eligiblePosLines || 0),
      uncoveredPosLines: Number(rows(coverage)[0]?.uncoveredPosLines || 0),
      estimatedPosLines: Number(rows(coverage)[0]?.estimatedPosLines || 0),
      knownPosLines: Number(rows(coverage)[0]?.knownPosLines || 0),
      eligibleManualLines: Number(rows(coverage)[0]?.eligibleManualLines || 0),
      uncoveredManualLines: Number(rows(coverage)[0]?.uncoveredManualLines || 0),
      estimatedManualLines: Number(rows(coverage)[0]?.estimatedManualLines || 0),
      knownManualLines: Number(rows(coverage)[0]?.knownManualLines || 0),
      bookedOrdersMvr: Number(totalsRow.bookedOrdersMvr || 0),
      collectedMvr: Number(totalsRow.collectedMvr || 0),
      manualCollectedMvr: Number(totalsRow.manualCollectedMvr || 0),
      convertedPosOrdersMvr: Number(totalsRow.convertedPosOrdersMvr || 0),
      openReceivables: {
        MVR: Number(rows(receivables)[0]?.openMvr || 0),
        USD: Number(rows(receivables)[0]?.openUsd || 0),
      },
      verifiedRedotPayReceiptsUsd: Number(rows(receivables)[0]?.verifiedRedotPayReceiptsUsd || 0),
        realizedFxMvr: Number((await db.execute(sql`SELECT COALESCE(SUM(a.fx_variance_mvr), 0)::float8 AS "realizedFxMvr"
        FROM pos_accounting a JOIN pos_transactions p ON p.id = a.pos_id
        WHERE p.status='completed' AND p.converted_to_order_id IS NULL AND p.created_at::date BETWEEN ${from} AND ${to}`
        )).then(async (result: any) => {
          const posFx = Number(rows(result)[0]?.realizedFxMvr || 0);
          const manualFx = rows(await db.execute(sql`SELECT COALESCE(SUM(a.fx_variance_mvr), 0)::float8 AS "realizedFxMvr"
            FROM manual_order_accounting a JOIN orders o ON o.id = a.order_id
            WHERE o.status IN ('confirmed', 'paid', 'completed')
              AND o.status NOT IN ('cancelled', 'refunded')
              AND o.created_at::date BETWEEN ${from} AND ${to}`))[0]?.realizedFxMvr || 0;
          return posFx + Number(manualFx);
        })),
    });
    if (req.query.format === "csv") {
       const lines = [
         ["Metric", "Value"],
         ["Booked web orders MVR", summary.bookedOrdersMvr],
         ["Collected unconverted POS MVR", summary.collectedMvr],
         ["Collected manual orders MVR", summary.manualCollectedMvr],
         ["Converted POS orders (separate) MVR", summary.convertedPosOrdersMvr],
         ["Native open receivables MVR (unverified)", summary.openReceivables.MVR],
         ["Native open receivables USD", summary.openReceivables.USD],
         ["Verified RedotPay receipts USD", summary.verifiedRedotPayReceiptsUsd],
         ...(["MVR", "USD"] as const).map(currency => [`Offline receipts ${currency}`, summary.tenderCurrencies[currency].amount]),
         ["Realized FX MVR", summary.realizedFxMvr], ["GST", summary.gst.GST.taxAmountMvr], ["TGST", summary.gst.TGST.taxAmountMvr],
         ["Known COGS MVR", summary.cogs.knownMvr], ["Estimated COGS MVR", summary.cogs.estimatedMvr],
         ["Historical unknown COGS MVR", summary.cogs.historicalUnknownMvr], ["Uncovered POS lines", summary.uncoveredPosLines],
         ["Uncovered manual lines", summary.uncoveredManualLines], ["Landed cost capitalized MVR", summary.landedCostMvr],
         ["Overheads (non-landed) MVR", summary.overheadMvr],
         ["Offline operating result MVR", summary.offlineOperatingResultMvr ?? "Unavailable (known COGS coverage required)"],
       ].map(row => row.map(csvCell).join(",")).join("\r\n");
      res.type("text/csv").setHeader("Content-Disposition", `attachment; filename="accounting-${from}-${to}.csv"`).send(lines);
    } else res.json({ from, to, ...summary });
  }));
}