import type { Express, Request } from "express";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { orders } from "./schema.js";
import { accountingAudit, accountingSettings, expenses, manualOrderAccounting, manualOrderPaymentLines } from "./admin-ledger-schema.js";
import { calculatePosTax, settleSplitTender, convertTenderToMvr } from "./admin-accounting-math.js";
import { createCatalogOrder } from "./checkout.js";

function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value: any) { return createHash("sha256").update(stable(value)).digest("hex"); }
function actor(req: Request): { id: string; name: string } {
  const admin = (req.res?.locals as any)?.admin;
  if (!admin?.id) throw Object.assign(new Error("Admin session required"), { status: 401 });
  return { id: admin.id, name: admin.name || "" };
}
function fail(res: any, error: any) {
  const status = error?.status === 409 ? 409 : error?.status === 401 ? 401 : 400;
  return res.status(status).json({ message: error?.message || "Manual order could not be completed" });
}

export function registerAdminManualOrders(app: Express, getDb: () => any) {
  app.get("/api/admin/manual-orders/settings", async (req, res) => {
    try {
      actor(req);
      const [settings] = await getDb().select().from(accountingSettings).limit(1);
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        taxEnabled: settings?.taxEnabled ?? false,
        gstRate: Number(settings?.gstRate ?? 0),
        tgstRate: Number(settings?.tgstRate ?? 0),
         usdToMvrRate: settings?.usdToMvrRate == null ? 15.42 : Number(settings.usdToMvrRate),
      });
    } catch (error: any) {
      return res.status(error?.status === 401 ? 401 : 503).json({ message: error?.message || "Manual-order settings are unavailable." });
    }
  });

  app.post("/api/admin/manual-orders", async (req, res) => {
    let key: string | null = null;
    try {
      const admin = actor(req);
      const supplied = req.get("Idempotency-Key")?.trim();
      if (supplied) {
        if (supplied.length > 200 || /[\r\n]/.test(supplied)) throw new Error("Invalid Idempotency-Key");
        key = supplied;
      }
      const body = req.body || {};
      const requestHash = hash(body);
      const db = getDb();
      if (key) {
        const result = await db.execute(sql`SELECT order_id, request_hash FROM manual_order_accounting WHERE idempotency_key = ${key} LIMIT 1`);
        const existing = (Array.isArray(result) ? result : result.rows || [])[0];
        if (existing) {
          if (existing.request_hash !== requestHash) return res.status(409).json({ message: "Idempotency-Key was already used for a different manual order payload" });
          const order = await db.select().from(orders).where(sql`id = ${existing.order_id}`).limit(1);
          if (order[0]) return res.json(order[0]);
        }
      }
      const lines = body.paymentLines;
      if (!Array.isArray(lines) || !lines.length) throw new Error("At least one payment line is required");
      const methods = new Set(["cash", "card", "bml_transfer", "transfer", "bank", "usd_cash"]);
      for (const line of lines) {
        if (!line || !methods.has(line.method) || !["MVR", "USD"].includes(line.currency)) throw new Error("Invalid payment line");
        if (line.currency === "USD" && line.method !== "usd_cash") throw new Error("USD manual tender only supports usd_cash");
        if (line.currency === "MVR" && !["cash", "card", "bml_transfer", "transfer", "bank"].includes(line.method)) throw new Error("MVR manual tender must be cash, card, or bml_transfer");
        if (line.feeMvr !== undefined && Number(line.feeMvr) !== 0) throw new Error("Per-line payment fees are not supported");
      }
      const fee = body.feeMvr ?? 0;
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(fee))) throw new Error("Invalid processing fee");
      const taxType = body.taxType || "NONE";
      if (!["NONE", "GST", "TGST"].includes(taxType)) throw new Error("taxType must be NONE, GST, or TGST");
      const input = { ...body, adminManual: true, paymentMethod: "cod", couponCode: body.couponCode || "" };
      await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1000 INCREMENT 1`);
      const [settings] = await db.select().from(accountingSettings).limit(1);
      const taxEnabled = settings?.taxEnabled === true;
      if (!taxEnabled && taxType !== "NONE") throw new Error("Tax is disabled in accounting settings");
      const rate = taxType === "GST" ? Number(settings?.gstRate ?? 0) : taxType === "TGST" ? Number(settings?.tgstRate ?? 0) : 0;
      const now = new Date();
      const seqResult = await db.execute(sql`SELECT nextval('invoice_seq') AS nextval`);
      const seqRow = Array.isArray(seqResult) ? seqResult[0] : seqResult.rows?.[0];
      const ref = String(seqRow?.nextval || Date.now());
      const date = now.toISOString().slice(0, 10).replace(/-/g, "");
      input.orderNumber = `MAN-${date}-${ref}`;
      input.trackingNumber = `MAN${date}${ref}`;
      let accounting: any;
      let activeUsdToMvrRate = 15.42;
      const order = await createCatalogOrder(db, input, async (tx: any, payload: any) => {
        // The rate is read and locked in the catalog transaction, immediately
        // before settlement. Never trust a rate cached by the admin client.
        const rateResult = await tx.execute(sql`SELECT usd_to_mvr_rate FROM accounting_settings LIMIT 1 FOR SHARE`);
        const rateRow = Array.isArray(rateResult) ? rateResult[0] : rateResult.rows?.[0];
        activeUsdToMvrRate = Number(rateRow?.usd_to_mvr_rate ?? 15.42);
        if (!Number.isFinite(activeUsdToMvrRate) || activeUsdToMvrRate <= 0) throw new Error("Active USD/MVR rate is invalid");
        for (const line of lines) {
          if (line.currency === "USD" && Number(line.usdToMvrRate) !== activeUsdToMvrRate) {
            throw Object.assign(new Error("USD/MVR rate changed. Refresh the manual order and try again."), { status: 409 });
          }
        }
        payload.usdToMvrRate = activeUsdToMvrRate.toFixed(6);
        const tax = calculatePosTax({ subtotal: payload.subtotal + payload.shipping, discount: payload.discount, taxEnabled, taxType, taxRate: rate });
        const settlement = settleSplitTender(tax.totalMinor / 100, lines.map((line: any) => ({
          method: line.method === "transfer" || line.method === "bank" ? "bml_transfer" : line.method,
          currency: line.currency, amount: line.amount, rate: line.currency === "USD" ? activeUsdToMvrRate : line.usdToMvrRate,
        })));
        accounting = { tax, settlement };
        payload.total = tax.totalMinor / 100;
        payload.paymentMethod = "manual";
        payload.status = "confirmed";
        payload.statusHistory = [{ status: "confirmed", timestamp: new Date().toISOString() }];
        payload.notes = [payload.notes, "admin_manual_order"].filter(Boolean).join(" — ");
      }, { afterInsert: async (tx: any, payload: any, created: any) => {
        await tx.insert(manualOrderAccounting).values({
          orderId: created.id, idempotencyKey: key, requestHash, createdBy: admin.id,
          taxType: accounting.tax.taxType, taxableBaseMvr: String(accounting.tax.taxableMinor / 100),
          taxRate: accounting.tax.taxRate, taxAmountMvr: String(accounting.tax.taxMinor / 100),
          feeMvr: String(fee), statusSnapshot: created.status,
        });
        const dbLines = lines.map((line: any, i: number) => {
          const normalized = line.method === "transfer" || line.method === "bank" ? "bml_transfer" : line.method;
           const converted = convertTenderToMvr({ currency: line.currency, amount: line.amount, rate: line.currency === "USD" ? activeUsdToMvrRate : line.usdToMvrRate });
          return { orderId: created.id, method: normalized, currency: line.currency, amount: String(line.amount), usdToMvrRate: converted.rate, amountMvr: String(converted.mvrMinor / 100), feeMvr: String(line.feeMvr ?? 0), reference: line.reference ?? null };
        });
        await tx.insert(manualOrderPaymentLines).values(dbLines);
        if (Number(fee) > 0) await tx.insert(expenses).values({
          category: "processing_fee", description: `Manual order ${created.orderNumber} processing fee`,
          amount: String(fee), currency: "MVR", usdToMvrRate: null, amountMvr: String(fee),
          isLanded: false, expenseDate: new Date(), actorId: admin.id,
        });
        await tx.insert(accountingAudit).values({
          actorId: admin.id, entityKind: "manual_order", entityId: created.id, action: "created",
          reason: "Admin manual order", data: { orderNumber: created.orderNumber, taxType: accounting.tax.taxType, paymentLineCount: dbLines.length },
        });
      }});
      return res.json(order);
    } catch (error: any) {
      if (error?.code === "23505" && key) {
        try {
          const db = getDb();
          const result = await db.execute(sql`SELECT order_id, request_hash FROM manual_order_accounting WHERE idempotency_key = ${key} LIMIT 1`);
          const row = (Array.isArray(result) ? result : result.rows || [])[0];
          if (row?.request_hash === hash(req.body)) {
            const order = await db.select().from(orders).where(sql`id = ${row.order_id}`).limit(1);
            if (order[0]) return res.json(order[0]);
          }
        } catch { /* preserve original conflict below */ }
      }
      return fail(res, error);
    }
  });
}