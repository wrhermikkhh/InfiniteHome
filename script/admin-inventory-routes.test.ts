import assert from "node:assert/strict";
import test from "node:test";
import { receiptPayloadMatches, validateBulkAdjustmentInput, validateReceiptInput } from "../shared/admin-inventory-routes.js";

test("receipt validation requires supplier and manual USD rate", () => {
  const base = { productId: "p1", quantity: 4, supplierCost: 12, receiptKey: "r-1" };
  assert.equal(validateReceiptInput(base).success, false);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier" }).success, true);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", costCurrency: "USD" }).success, false);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", costCurrency: "USD", exchangeRate: 15.4 }).success, true);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", quantity: 0 }).success, false);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", arrivedAt: "2025-02-28" }).success, true);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", arrivedAt: "2024-02-30" }).success, false);
  assert.equal(validateReceiptInput({ ...base, supplierName: "Supplier", arrivedAt: "2025/02/28" }).success, false);
});

test("receipt idempotency compares the immutable receipt payload", () => {
  const input = {
    productId: "p1", quantity: 4, supplierCost: 12, receiptKey: "r-1",
    supplierName: "Supplier", costCurrency: "USD" as const, exchangeRate: 15.4,
    landedCostMvr: 190, arrivedAt: "2025-02-28", reference: "PO-7",
  };
  const existing = {
    product_id: "p1", variant_key: null, quantity_received: "4",
    supplier_id: "s1", supplier_cost: "12", cost_currency: "USD",
    exchange_rate: "15.4", unit_landed_cost_mvr: "190",
    arrived_at: new Date("2025-02-28T00:00:00.000Z"), reference: "PO-7",
  };
  assert.equal(receiptPayloadMatches(existing, input, "s1"), true);
  assert.equal(receiptPayloadMatches(existing, { ...input, quantity: 5 }, "s1"), false);
  assert.equal(receiptPayloadMatches(existing, { ...input, reference: "PO-8" }, "s1"), false);
  assert.equal(receiptPayloadMatches(existing, { ...input, arrivedAt: "2025-03-01" }, "s1"), false);
  assert.equal(receiptPayloadMatches(existing, input, "s2"), false);
});

test("bulk adjustment validation requires one target form and a reason", () => {
  const row = { productId: "p1", expectedBalance: 5, targetBalance: 3 };
  assert.equal(validateBulkAdjustmentInput({ reason: "Count correction", rows: [row] }).success, true);
  assert.equal(validateBulkAdjustmentInput({ reason: "x", rows: [row] }).success, false);
  assert.equal(validateBulkAdjustmentInput({ reason: "Count correction", rows: [{ ...row, delta: -2 }] }).success, false);
  assert.equal(validateBulkAdjustmentInput({ reason: "Count correction", rows: [{ productId: "p1", expectedBalance: 5, delta: -2 }] }).success, true);
  assert.equal(validateBulkAdjustmentInput({ reason: "Count correction", rows: [row, row] }).success, false);
});