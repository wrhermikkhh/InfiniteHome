import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculatePosTax,
  convertTenderToMvr,
  settleSplitTender,
} from "../shared/admin-accounting-math";

test("POS tax is disabled by default and ignores client tax claims", () => {
  const result = calculatePosTax({
    subtotal: "100.00",
    discount: "10.00",
    taxEnabled: false,
    taxType: "GST",
    taxRate: "15",
  });
  assert.equal(result.taxMinor, 0);
  assert.equal(result.totalMinor, 9000);
});

test("USD POS tender requires a manually supplied rate", () => {
  assert.throws(() => convertTenderToMvr({ currency: "USD", amount: "10" }), /manual MVR\/USD rate/);
  assert.deepEqual(
    convertTenderToMvr({ currency: "USD", amount: "10", rate: "15.50" }),
    { currency: "USD", amountMinor: 1000, mvrMinor: 15500, rate: "15.50" },
  );
});

test("split tender settles exactly and permits only MVR cash change", () => {
  const result = settleSplitTender("100.00", [
    { method: "bank", currency: "MVR", amount: "40" },
    { method: "cash", currency: "MVR", amount: "65" },
  ]);
  assert.equal(result.totalTenderedMvrMinor, 10500);
  assert.equal(result.changeMvrMinor, 500);
  assert.throws(() => settleSplitTender("100", [{ method: "card", currency: "MVR", amount: "101" }]), /MVR cash change/);
});

test("POS contract whitelists tender combinations and validates fee precision", () => {
  const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(source, /"cash", "bml_transfer", "card"/);
  assert.match(source, /currency === "USD" && method === "usd_cash"/);
  assert.match(source, /feeMvr/);
  assert.match(source, /\\d\{1,2\}/);
  assert.match(source, /At least one payment tender is required/);
});

test("POS route derives cashier and financial values server-side", () => {
  const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(source, /cashierId: actor\.id/);
  assert.match(source, /cashierName: actor\.name/);
  assert.match(source, /const transaction = await storage\.createPosTransaction/);
  assert.doesNotMatch(source, /cashierId: String\(req\.body\.cashierId/);
  assert.doesNotMatch(source, /total: Number\(req\.body\.total/);
  assert.doesNotMatch(source, /gstAmount: Number\(req\.body\.gstAmount/);
  assert.match(source, /Cashier identity is controlled by the signed-in admin/);
});

test("POS sale retries use an idempotency key before invoice sequencing", () => {
  const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(source, /req\.get\("Idempotency-Key"\)/);
  assert.match(source, /requestHash\(req\.body\)/);
  assert.match(source, /Idempotency-Key was already used for a different POS payload/);
  const posStart = source.indexOf('app.post("/api/pos/transactions",');
  assert.ok(source.indexOf("const [existing] = await db.select().from(posAccounting)", posStart) <
    source.indexOf("const invoiceSeq = await storage.getNextInvoiceSeq()", posStart));
});

test("POS idempotency is persisted with a partial unique index", () => {
  const schema = readFileSync(new URL("../shared/admin-ledger-schema.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../script/admin-ledger-migration.sql", import.meta.url), "utf8");
  assert.match(schema, /idempotencyKey: text\("idempotency_key"\)/);
  assert.match(schema, /requestHash: text\("request_hash"\)/);
  assert.match(schema, /uniqueIndex\("pos_accounting_idempotency_key_idx"\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS idempotency_key/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS pos_accounting_idempotency_key_idx/);
});

test("POS checkout keeps a key across identical retries and rotates after payload changes", () => {
  const source = readFileSync(new URL("../client/src/pages/AdminPanel.tsx", import.meta.url), "utf8");
  const posStart = source.indexOf('fetch("/api/pos/transactions"');
  const section = source.slice(Math.max(0, posStart - 1800), posStart + 700);
  assert.match(section, /posIdempotencyRef\.current\.payload/);
  assert.match(section, /crypto\.randomUUID\(\)/);
  assert.match(section, /"Idempotency-Key": posIdempotencyRef\.current\.key/);
});

test("POS server applies the exact variant sale formula before settlement", () => {
  const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(source, /function posVariantSalePrice/);
  assert.match(source, /Math\.round\(variantPrice \* \(1 - product\.salePercent \/ 100\) \* 100\) \/ 100/);
  assert.match(source, /const derivedPercent = \(\(product\.price - product\.salePrice\) \/ product\.price\) \* 100/);
  assert.match(source, /const catalogPrice = posVariantSalePrice\(product, rawVariantPrice\)/);
});

test("POS USD references are read-only and never used for MVR pricing", () => {
  const server = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../client/src/pages/AdminPanel.tsx", import.meta.url), "utf8");
  assert.match(server, /\/api\/pos\/products\/:id\/variant-prices/);
  assert.match(server, /variantKey: productVariantCommercial\.variantKey/);
  assert.match(server, /usdPrice: productVariantCommercial\.usdPrice/);
  assert.match(client, /USD reference:/);
  assert.match(client, /manual tender only/);
  assert.match(client, /\/api\/pos\/products\/\$\{encodeURIComponent\(product\.id\)\}\/variant-prices/);
});

test("POS USD tenders match the locked active rate and snapshot the sale rate", () => {
  const server = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const storage = readFileSync(new URL("../server/storage.ts", import.meta.url), "utf8");
  assert.match(server, /tax_enabled AS "taxEnabled"/);
  assert.match(server, /gst_rate AS "gstRate"/);
  assert.match(server, /tgst_rate AS "tgstRate"/);
  assert.match(server, /USD\/MVR rate changed\. Refresh the POS sale/);
  assert.match(server, /usdToMvrRate: activeUsdToMvrRate\.toFixed\(6\)/);
  assert.match(server, /usdToMvrRate \?\? 15\.42/);
  assert.match(storage, /FROM accounting_settings WHERE id = 1 FOR SHARE/);
  assert.match(storage, /suppliedRate !== activeRate/);
  assert.match(storage, /status: 409/);
  assert.match(server, /error\?\.status === 409 \? 409 : 400/);
});