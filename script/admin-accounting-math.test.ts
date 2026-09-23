import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePosTax, consumeCostLayers, convertTenderToMvr, explicitFxGainLoss,
  landedUnitCost, processingFee, settleSplitTender, toMinorUnits,
} from "../shared/admin-accounting-math.js";

test("minor-unit parsing is strict and rounds only through explicit decimal precision", () => {
  assert.throws(() => toMinorUnits("12.345"));
});

test("minor-unit validation rejects malformed, negative, and non-finite values", () => {
  for (const value of ["-1", "1e2", "1.", "", Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => toMinorUnits(value as never));
  }
  assert.equal(toMinorUnits("12.34"), 1234);
});

test("tax is disabled by default and GST/TGST applies after discount", () => {
  assert.deepEqual(calculatePosTax({ subtotal: "100.00", discount: "10.00" }), {
    subtotalMinor: 10000, discountMinor: 1000, taxableMinor: 9000, taxMinor: 0, totalMinor: 9000, taxType: "NONE", taxRate: "0",
  });
  assert.equal(calculatePosTax({ subtotal: "100.00", discount: "10.00", taxEnabled: true, taxType: "GST", taxRate: "8.5" }).taxMinor, 765);
  assert.equal(calculatePosTax({ subtotal: "100.00", taxEnabled: true, taxType: "TGST", taxRate: "8.5" }).totalMinor, 10850);
  assert.throws(() => calculatePosTax({ subtotal: 10, taxType: "GST", taxRate: 100.01, taxEnabled: true }));
});

test("USD POS tender requires a manual rate and converts with six-decimal rate", () => {
  assert.equal(convertTenderToMvr({ currency: "USD", amount: "10.00", rate: "15.420000" }).mvrMinor, 15420);
  assert.throws(() => convertTenderToMvr({ currency: "USD", amount: 10 }));
  assert.throws(() => convertTenderToMvr({ currency: "USD", amount: 10, rate: "15.1234567" }));
});

test("split tenders must settle exactly, with MVR cash-only change", () => {
  assert.equal(settleSplitTender("100.00", [
    { method: "card", currency: "MVR", amount: "40" },
    { method: "cash", currency: "USD", amount: "4", rate: "15" },
  ]).changeMvrMinor, 0);
  assert.equal(settleSplitTender("100.00", [{ method: "cash", currency: "MVR", amount: "120" }]).changeMvrMinor, 2000);
  assert.throws(() => settleSplitTender("100", [{ method: "card", currency: "MVR", amount: "101" }]));
  assert.throws(() => settleSplitTender("100", [{ method: "cash", currency: "MVR", amount: "99.99" }]));
});

test("fees are separate operational expense and FX needs explicit valuations", () => {
  assert.deepEqual(processingFee("2.50", "100.00"), { feeMinor: 250, customerTotalMinor: 10000, operationalExpenseMinor: 250 });
  assert.deepEqual(explicitFxGainLoss("1542.00", "1600.00"), { bookMvrMinor: 154200, settlementMvrMinor: 160000, gainLossMvrMinor: 5800 });
});

test("landed cost allocates freight and customs across a batch", () => {
  assert.deepEqual(landedUnitCost({ quantity: 3, purchaseUnitCost: "10", landedCosts: ["2.00", "1.00"] }), { quantity: 3, totalCostMinor: 3300, unitCostMinor: 1100 });
});

test("FIFO and prospective moving average consume cost layers", () => {
  assert.deepEqual(consumeCostLayers([{ quantity: 2, unitCostMinor: 100 }, { quantity: 3, unitCostMinor: 200 }], 3), {
    costMinor: 400, remaining: [{ quantity: 2, unitCostMinor: 200 }],
  });
  assert.deepEqual(consumeCostLayers([{ quantity: 2, unitCostMinor: 100 }, { quantity: 2, unitCostMinor: 300 }], 2, "AVERAGE"), {
    costMinor: 400, remaining: [{ quantity: 2, unitCostMinor: 200 }],
  });
});