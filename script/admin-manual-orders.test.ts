import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("manual order route is isolated, authorized, and idempotent", () => {
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  const security = readFileSync(new URL("../shared/admin-security.ts", import.meta.url), "utf8");
  assert.match(route, /\/api\/admin\/manual-orders/);
  assert.match(security, /manual-orders.*canManageOrders/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /different manual order payload/);
  assert.match(route, /manualOrderAccounting/);
  assert.match(route, /manualOrderPaymentLines/);
  assert.match(route, /\/api\/admin\/manual-orders\/settings/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("manual order accounting is committed through the catalog transaction hook", () => {
  const checkout = readFileSync(new URL("../shared/checkout.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  assert.match(checkout, /validateQuote\?:/);
  assert.match(checkout, /afterInsert\?:/);
  assert.ok(checkout.indexOf("recordSaleCosts") < checkout.indexOf("hooks?.afterInsert"));
  assert.match(route, /afterInsert: async/);
  assert.match(route, /tx\.insert\(expenses\)/);
  assert.match(route, /tx\.insert\(accountingAudit\)/);
});

test("manual order contract derives catalog totals and requires exact split settlement", () => {
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  assert.match(route, /createCatalogOrder\(db, input/);
  assert.match(route, /calculatePosTax/);
  assert.match(route, /settleSplitTender/);
  assert.match(route, /payload\.total = tax\.totalMinor \/ 100/);
  assert.match(route, /payload\.paymentMethod = "manual"/);
});

test("manual tender methods keep USD cash separate from MVR tenders", () => {
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  assert.match(route, /line\.currency === "USD" && line\.method !== "usd_cash"/);
  assert.match(route, /line\.currency === "MVR" && !\["cash", "card", "bml_transfer", "transfer", "bank"\]/);
  assert.match(route, /Per-line payment fees are not supported/);
});

test("manual orders reject active tax when accounting tax is disabled", () => {
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  assert.match(route, /taxType must be NONE, GST, or TGST/);
  assert.match(route, /!taxEnabled && taxType !== "NONE"/);
  assert.match(route, /Tax is disabled in accounting settings/);
});

test("manual USD tenders use the locked active accounting rate and snapshot it", () => {
  const route = readFileSync(new URL("../shared/admin-manual-orders.ts", import.meta.url), "utf8");
  assert.match(route, /usd_to_mvr_rate FROM accounting_settings.*FOR SHARE/);
  assert.match(route, /USD\/MVR rate changed\. Refresh the manual order/);
  assert.match(route, /payload\.usdToMvrRate/);
  assert.match(route, /activeUsdToMvrRate/);
});