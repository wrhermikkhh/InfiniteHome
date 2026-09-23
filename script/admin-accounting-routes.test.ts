import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accountingReportSummary, calculateRealizedFxMvr, redotPayUsdMetrics, taxExportCsv } from "../shared/admin-accounting-routes.js";

test("accounting report separates GST, tender currency, costs, and profit coverage", () => {
  const report = accountingReportSummary({
    gst: [
      { taxType: "GST", taxableBaseMvr: 100, taxAmountMvr: 8 },
      { taxType: "TGST", taxableBaseMvr: 50, taxAmountMvr: 4 },
    ],
    tenders: [
      { currency: "MVR", amount: 100, amountMvr: 100 },
      { currency: "USD", amount: 10, amountMvr: 150 },
    ],
    cogs: [
      { confidence: "known", totalCostMvr: 40 },
      { confidence: "estimated", totalCostMvr: 10 },
      { confidence: "historical_unknown", totalCostMvr: 1 },
    ],
    expenses: [{ amountMvr: 5 }],
    bookedOrdersMvr: 300,
    collectedMvr: 250,
    convertedPosOrdersMvr: 40,
  });
  assert.deepEqual(report.gst.GST, { taxableBaseMvr: 100, taxAmountMvr: 8 });
  assert.deepEqual(report.tenderCurrencies.USD, { amount: 10, amountMvr: 150 });
  assert.equal(report.bookedOrdersMvr, 300);
  assert.equal(report.collectedMvr, 250);
  assert.equal(report.convertedPosOrdersMvr, 40);
  assert.equal(report.completeCostCoverage, false);
  assert.equal(report.posOperatingResultMvr, null);
});

test("profit is available only when no historical COGS is unknown", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [{ confidence: "known", totalCostMvr: 40 }],
    expenses: [{ amountMvr: 10, fee: true }], bookedOrdersMvr: 100, collectedMvr: 100,
  });
  assert.equal(report.completeCostCoverage, true);
  assert.equal(report.posOperatingResultMvr, 50);
});

test("realized FX uses booked USD tender rates exactly once at settlement", () => {
  assert.equal(calculateRealizedFxMvr([
    { amount: 10, bookedRate: 15 },
    { amount: 5, bookedRate: 14.5 },
  ], 16), 17.5);
  assert.throws(() => calculateRealizedFxMvr([{ amount: 10, bookedRate: 15 }], 0), /positive/);
});

test("unknown COGS blocks POS operating result even when FX is realized", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [{ confidence: "historical_unknown", totalCostMvr: 20 }],
    expenses: [], bookedOrdersMvr: 100, collectedMvr: 80, realizedFxMvr: 5,
  });
  assert.equal(report.realizedFxMvr, 5);
  assert.equal(report.posOperatingResultMvr, null);
});

test("historical POS lines with no COGS cannot appear fully covered", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [], expenses: [],
    bookedOrdersMvr: 0, collectedMvr: 120,
    eligiblePosLines: 2, uncoveredPosLines: 2, knownPosLines: 0,
  });
  assert.equal(report.completeCostCoverage, false);
  assert.equal(report.posOperatingResultMvr, null);
});

test("estimated COGS remains separate and does not permit an exact result", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [{ confidence: "estimated", totalCostMvr: 20 }],
    expenses: [], bookedOrdersMvr: 0, collectedMvr: 120,
    eligiblePosLines: 1, estimatedPosLines: 1, knownPosLines: 0,
  });
  assert.equal(report.cogs.estimatedMvr, 20);
  assert.equal(report.completeCostCoverage, false);
  assert.equal(report.posOperatingResultMvr, null);
});

test("tax export is a detailed MRA review worksheet and escapes CSV values", () => {
  const csv = taxExportCsv([{
    source: "POS",
    invoiceRef: "POS-2026-1", recordedAt: "2026-01-02T03:04:05.000Z", saleId: "sale-1",
    status: "completed", taxType: "GST", taxableBaseMvr: 100, appliedRate: 8,
    taxAmountMvr: 8, grossMvr: 108, discountMvr: 0, netMvr: 100,
    paymentMethod: "bank, transfer", paymentCurrency: "USD; MVR",
    usdToMvrRate: 15.5, paymentReference: 'Slip "A"',
  }]);
  assert.match(csv, /^"Source","Invoice reference","Recorded date\/time","Sale ID"/);
  assert.match(csv, /"bank, transfer"/);
  assert.match(csv, /"Slip ""A"""/);
  assert.match(csv, /GST/);
  assert.match(csv, /2026-01-02T03:04:05.000Z/);
});

test("paid manual collections stay separate from booked online orders", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [], expenses: [],
    bookedOrdersMvr: 500, collectedMvr: 120, manualCollectedMvr: 80,
    eligiblePosLines: 0, eligibleManualLines: 0,
  });
  assert.equal(report.bookedOrdersMvr, 500);
  assert.equal(report.collectedMvr, 120);
  assert.equal(report.manualCollectedMvr, 80);
  assert.equal(report.offlineCollectedMvr, 200);
  assert.equal(report.posOperatingResultMvr, 120);
  assert.equal(report.offlineOperatingResultMvr, 200);
});

test("manual USD FX settlement sums every USD line exactly once", () => {
  assert.equal(calculateRealizedFxMvr([
    { amount: 10, bookedRate: 15 },
    { amount: 5, bookedRate: 15.5 },
  ], 16), 12.5);
});

test("open receivables remain native currency buckets", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [], expenses: [],
    bookedOrdersMvr: 0, collectedMvr: 0,
    openReceivables: { MVR: 120, USD: 10 },
    verifiedRedotPayReceiptsUsd: 25,
  });
  assert.deepEqual(report.openReceivables, { MVR: 120, USD: 10 });
  assert.equal(report.unverifiedOpenMvr, 120);
  assert.equal(report.verifiedRedotPayReceiptsUsd, 25);
  // There is intentionally no converted USD amount in the MVR balance.
  assert.equal((report.openReceivables as any).MVR + (report.openReceivables as any).USD, 130);
});

test("missing open receivables are safe and do not create a cross-currency balance", () => {
  const report = accountingReportSummary({
    gst: [], tenders: [], cogs: [], expenses: [],
    bookedOrdersMvr: 0, collectedMvr: 0,
  });
  assert.deepEqual(report.openReceivables, { MVR: 0, USD: 0 });
  assert.equal(report.verifiedRedotPayReceiptsUsd, 0);
});

test("closed RedotPay attempts are not open USD receivables", () => {
  assert.deepEqual(redotPayUsdMetrics([
    { state: "pending", usdCents: 1250 },
    { state: "closed", usdCents: 900 },
    { state: "paid", usdCents: 500 },
  ]), { openUsd: 12.5, verifiedReceiptsUsd: 5 });
});

test("accounting unions and COGS joins support UUID POS IDs beside text order IDs", () => {
  const routes = readFileSync(new URL("../shared/admin-accounting-routes.ts", import.meta.url), "utf8");
  assert.match(routes, /c\.sale_id=p\.id::text/);
  assert.match(routes, /SELECT 'POS' AS sale_kind, p\.id::text AS sale_id/);
  assert.match(routes, /SELECT 'ORDER' AS sale_kind, o\.id::text AS sale_id/);
  assert.match(routes, /p\.id::text AS "saleId"/);
  assert.match(routes, /o\.id::text AS "saleId"/);
});

test("manual FX settlement uses its audit event, not the default zero variance, as the one-time marker", () => {
  const routes = readFileSync(new URL("../shared/admin-accounting-routes.ts", import.meta.url), "utf8");
  const settlement = routes.split('app.post("/api/admin/accounting/manual-orders/:id/fx-settlement"')[1]
    ?.split('app.get("/api/admin/accounting/tax-export.csv"')[0];
  assert.ok(settlement);
  assert.match(settlement, /entity_kind = 'manual_order_fx_settlement'/);
  assert.match(settlement, /if \(already\)/);
  assert.doesNotMatch(settlement, /existingVariance/);
});