import assert from "node:assert/strict";
import test from "node:test";
import { matchesReportFacets, type ReportFacets } from "../client/src/lib/report-filters.js";

const all: ReportFacets = { status: [], payment: [], delivery: [], source: [] };
const order = { status: "confirmed", payment: "bank_transfer", delivery: "delivery", source: "orders" as const };

test("empty selections show all sources and values", () => {
  assert.equal(matchesReportFacets(all, order), true);
  assert.equal(matchesReportFacets(all, { ...order, source: "pos" }), true);
});

test("multiple selections within a group match either value while groups combine", () => {
  const filters: ReportFacets = {
    status: ["confirmed", "shipped"],
    payment: ["bank_transfer", "cod"],
    delivery: ["delivery", "pickup"],
    source: ["orders"],
  };
  assert.equal(matchesReportFacets(filters, order), true);
  assert.equal(matchesReportFacets(filters, { ...order, status: "shipped", payment: "cod", delivery: "pickup" }), true);
  assert.equal(matchesReportFacets(filters, { ...order, payment: "redotpay" }), false);
  assert.equal(matchesReportFacets(filters, { ...order, delivery: "courier" }), false);
  assert.equal(matchesReportFacets(filters, { ...order, status: "pending" }), false);
  assert.equal(matchesReportFacets(filters, { ...order, source: "pos" }), false);
});

test("selecting both sources includes orders and POS, without relaxing other filters", () => {
  const filters: ReportFacets = { ...all, source: ["orders", "pos"], status: ["completed"] };
  assert.equal(matchesReportFacets(filters, { ...order, source: "pos", status: "completed" }), true);
  assert.equal(matchesReportFacets(filters, { ...order, status: "completed" }), true);
  assert.equal(matchesReportFacets(filters, order), false);
});