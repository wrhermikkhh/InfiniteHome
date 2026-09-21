import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { consumePaymentRateLimit, isPaymentOperator, registerRedotPay, reservationNetwork } from "../shared/redotpay-routes";
import { acceptanceWebhookConfig, config, SANDBOX_API_ORIGIN, SANDBOX_PUBLIC_KEY, providerRequest } from "../shared/redotpay";

// Isolated acceptance harness: no network, environment reads, real credentials or DB.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = publicKey.export({ format: "pem", type: "spki" }).toString();
const dialect = new PgDialect();
const settings = { origin: "https://shop.example.com", key: privateKey, version: "1", appKey: "fixture", webhookKey: pem };

test("fixture platform public key override is preview-only, opt-in and checkout-disabled", () => {
  const env = { VERCEL_ENV: "preview", REDOTPAY_ENABLED: "false",
    REDOTPAY_ACCEPTANCE_ENABLED: "I_ACCEPT_NON_PRODUCTION_WEBHOOK_TESTS",
    REDOTPAY_ACCEPTANCE_APP_KEY: "fixture", REDOTPAY_ACCEPTANCE_WEBHOOK_PUBLIC_KEY: pem };
  assert.equal(acceptanceWebhookConfig(env)?.webhookKey, pem);
  assert.equal(acceptanceWebhookConfig({ ...env, VERCEL_ENV: "production" }), null);
  assert.equal(acceptanceWebhookConfig({ ...env, REDOTPAY_ENABLED: "true" }), null);
  assert.equal(acceptanceWebhookConfig({ ...env, REDOTPAY_ACCEPTANCE_ENABLED: "true" }), null);
});

test("operator role checks use current server permissions, not merely a session ID", () => {
  assert.equal(isPaymentOperator({ id: "a" }), false);
  assert.equal(isPaymentOperator({ id: "a", isSuperAdmin: true }), true);
  assert.equal(isPaymentOperator({ id: "a", permissions: { canManageOrders: true } }), true);
  assert.equal(isPaymentOperator({ id: "a", permissions: { canManageProducts: true } }), false);
});

test("legacy fulfillment exception is paid-only and cannot change payment status", async () => {
  const routes: Record<string, any> = {};
  const app: any = Object.fromEntries(["get", "post", "use"].map(m => [m, (p: string, handler: any) => { routes[`${m} ${p}`] = handler; }]));
  let paid = true;
  registerRedotPay(app, () => ({ execute: async (query: any) =>
    dialect.sqlToQuery(query).sql.includes("FROM orders")
      ? [{ payment_method: "redotpay" }] : [{ state: paid ? "paid" : "pending" }] }), {});
  const guard = routes["use /api/orders/:id"];
  const res: any = { locals: { admin: { id: "operator", permissions: { canManageOrders: true } } }, status: () => res, json: () => res };
  let passed = 0;
  const req: any = { method: "PATCH", params: { id: "o1" }, path: "/delivery-status", body: { deliveryStatus: "delivered" } };
  await guard(req, res, () => passed++);
  assert.equal(passed, 1);
  paid = false;
  await guard(req, res, () => passed++);
  paid = true;
  await guard({ ...req, path: "/status", body: { status: "cancelled" } }, res, () => passed++);
  await guard({ ...req, body: { deliveryStatus: "delivered", status: "confirmed" } }, res, () => passed++);
  assert.equal(passed, 1);
});

test("sandbox uses only documented pinned endpoint/key; live requires a separate release gate", async () => {
  const env = { REDOTPAY_ENABLED: "true", REDOTPAY_ENVIRONMENT: "sandbox", REDOTPAY_PUBLIC_ORIGIN: settings.origin,
    REDOTPAY_MVR_PER_USD: "15.42", REDOTPAY_APP_KEY: "sandbox-fixture", REDOTPAY_KEY_VERSION: "1",
    REDOTPAY_PRIVATE_KEY: privateKey.export({ format: "pem", type: "pkcs8" }).toString() };
  const selected = config(env);
  assert.equal(selected.apiOrigin, SANDBOX_API_ORIGIN);
  assert.equal(selected.webhookKey, SANDBOX_PUBLIC_KEY);
  assert.throws(() => config({ ...env, REDOTPAY_ENVIRONMENT: "production" }), /live payments remain disabled/);
  await providerRequest("/openapi/v2/order/detail", {}, (async (url: any) => {
    assert.equal(url, `${SANDBOX_API_ORIGIN}/openapi/v2/order/detail`);
    return new Response(JSON.stringify({ code: "SUCCESS", data: {} }));
  }) as typeof fetch, selected);
});

test("network keys normalize IPv4-mapped and IPv6 subnet rotation", () => {
  assert.equal(reservationNetwork("::ffff:192.0.2.1"), reservationNetwork("192.0.2.1"));
  assert.equal(reservationNetwork("2001:db8::1"), reservationNetwork("2001:0db8:0000:0000:aaaa::1"));
  assert.notEqual(reservationNetwork("2001:db8:1::1"), reservationNetwork("2001:db8:2::1"));
});

test("distributed rate limiter uses a single bounded atomic upsert, not process memory", async () => {
  let count = 0;
  const db = { execute: async (query: any) => {
    const q = dialect.sqlToQuery(query);
    assert.match(q.sql, /ON CONFLICT/);
    assert.match(q.sql, /hits < 30/);
    return ++count <= 30 ? [{ hits: count }] : [];
  } };
  const attempts = await Promise.allSettled(Array.from({ length: 50 }, () => consumePaymentRateLimit(db, "same-network")));
  assert.equal(attempts.filter(a => a.status === "fulfilled").length, 30);
  assert.equal(attempts.filter(a => a.status === "rejected").length, 20);
});

test("reservation caps deny before touching products or provider; old attempts bypass caps", async () => {
  for (const oldAttempt of [false, true]) {
    const routes: Record<string, any> = {};
    const app: any = Object.fromEntries(["get", "post", "use"].map(m => [m, (p: string, handler: any) => { routes[`${m} ${p}`] = handler; }]));
    let locked = false, budgetReads = 0, providerCalls = 0;
    const old = { id: "RP1", state: "unknown", payload: { total: 210 }, usd_cents: 1000 };
    const db: any = {
      transaction: async (fn: any) => fn(db),
      execute: async (query: any) => {
        const q = dialect.sqlToQuery(query);
        assert.ok(!q.sql.includes("FROM products"), "must not lock stock after budget rejection");
        if (q.sql.includes("LIMIT 0")) return [];
        if (q.sql.includes("redotpay_schema")) return [{ version: 2 }];
        if (q.sql.includes("INSERT INTO redotpay_limits")) return [{ hits: 1 }];
        if (q.sql.includes("pg_advisory_xact_lock") && q.sql.includes("redotpay-reservations")) locked = true;
        if (q.sql.includes("count(*) FILTER")) {
          assert.equal(locked, true);
          budgetReads++;
          return [{ total: 100, hourly: 200, owned: 2, owner_hourly: 10 }];
        }
        if (q.sql.includes("SELECT * FROM redotpay_payments")) return oldAttempt ? [old] : [];
        return [];
      },
    };
    registerRedotPay(app, () => db, {}, { configure: () => settings, request: async () => { providerCalls++; return {}; } });
    let status = 200;
    const res: any = { append: () => res, status: (s: number) => { status = s; return res; }, json: () => res };
    await routes["post /api/payments/redotpay/create"]({ ip: "192.0.2.1", body: {}, get: () => `Bearer ${"a".repeat(64)}` }, res);
    assert.equal(status, oldAttempt ? 200 : 429);
    assert.equal(budgetReads, oldAttempt ? 0 : 1);
    assert.equal(providerCalls, 0);
  }
});

function harness(detail: () => any, authenticated = true) {
  const routes: Record<string, any> = {};
  const app: any = Object.fromEntries(["get", "post", "use"].map(m => [m, (p: string, handler: any) => { routes[`${m} ${p}`] = handler; }]));
  const payment = { id: "RP1", state: "pending", provider_id: "provider1", order_id: "o1", usd_cents: 1000,
    payload: { total: 210 }, allocations: [{ productId: "p1", qty: 2 }], expires_at: new Date(), token_hash: "hidden" };
  let releases = 0, confirmations = 0, calls = 0, audits = 0;
  let queue = Promise.resolve();
  const db: any = {
    execute: async (query: any) => {
      const q = dialect.sqlToQuery(query);
      if (q.sql.includes("LIMIT 0")) return [];
      if (q.sql.includes("redotpay_schema")) return [{ version: 2 }];
      if (q.sql.includes("INSERT INTO redotpay_limits")) return [{ hits: 1 }];
      if (q.sql.includes("INSERT INTO redotpay_operator_audit")) { audits++; return []; }
      if (q.sql.includes("SELECT * FROM redotpay_payments")) return [{ ...payment }];
      if (q.sql.includes("SELECT * FROM products")) return [{ id: "p1", stock: 3 }];
      if (q.sql.includes("UPDATE products")) releases++;
      if (q.sql.includes("UPDATE orders SET status = 'confirmed'")) confirmations++;
      if (q.sql.includes("SET state = 'paid'")) payment.state = "paid";
      else if (q.sql.includes("SET state = 'closed'")) payment.state = "closed";
      else if (q.sql.includes("UPDATE redotpay_payments SET state =")) payment.state = String(q.params[0]);
      return [];
    },
    transaction: (fn: any) => {
      const result = queue.then(() => fn(db));
      queue = result.catch(() => {});
      return result;
    },
  };
  registerRedotPay(app, () => db, {}, { configure: () => settings,
    authenticateOperator: async () => authenticated ? { id: "operator-fixture" } : null,
    request: async (path) => {
      calls++;
      if (path.endsWith("/close")) return {};
      return { outerOrderSn: "RP1", orderSn: "provider1", orderCurrency: "USD", orderAmount: "10.00", ...await detail() };
    } });
  async function invoke(route: string, req: any = {}) {
    let status = 200, body: any;
    const res: any = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return res; } };
    await routes[route]({ method: route.startsWith("get") ? "GET" : "POST",
      get: (name: string) => name === "origin" ? settings.origin : undefined,
      ip: "192.0.2.1", params: { id: "RP1" }, query: {}, ...req }, res);
    return { status, body };
  }
  function webhook(raw = Buffer.from('{ "actionType": "ACQUIRER_PAY", "outerOrderSn": "RP1" }')) {
    const timestamp = String(Date.now());
    const signature = sign("RSA-SHA256", Buffer.concat([Buffer.from(`fixture.${timestamp}.`), raw]), privateKey).toString("base64");
    const headers: Record<string, string> = { "X-R-Ts": timestamp, "X-R-Signature": signature, "X-R-Key-Version": "1" };
    return { rawBody: raw, body: { actionType: "forged parsed body" }, get: (name: string) => headers[name] };
  }
  return { invoke, webhook, payment, stats: () => ({ releases, confirmations, calls, audits }) };
}

test("raw-body route accepts signed bytes only, ignores unrelated parsed body and rejects reserialization", async () => {
  const h = harness(() => ({ orderStatus: 2 }));
  const signed = h.webhook();
  const invalid = await h.invoke("post /api/payments/redotpay/webhook", { ...signed, rawBody: Buffer.from(JSON.stringify(JSON.parse(signed.rawBody.toString()))) });
  assert.equal(invalid.status, 401);
  assert.equal(h.stats().calls, 0);
  assert.equal((await h.invoke("post /api/payments/redotpay/webhook", signed)).status, 200);
  assert.equal(h.payment.state, "paid");
});

test("concurrent signed closure retries restore once under payment-row serialization", async () => {
  const h = harness(() => ({ orderStatus: 4 }));
  const replies = await Promise.all(Array.from({ length: 20 }, () => h.invoke("post /api/payments/redotpay/webhook", h.webhook())));
  assert.ok(replies.every(r => r.status === 200));
  assert.equal(h.payment.state, "closed");
  assert.equal(h.stats().releases, 1);
});

test("operator close versus paid webhook confirms once without releasing", async () => {
  let queries = 0;
  const h = harness(() => ({ orderStatus: ++queries === 1 ? 1 : 2 }));
  await Promise.all([
    h.invoke("post /api/admin/redotpay/attempts/:id/reconcile", { body: { action: "close", reason: "Customer requested cancellation" } }),
    ...Array.from({ length: 10 }, () => h.invoke("post /api/payments/redotpay/webhook", h.webhook())),
  ]);
  assert.equal(h.payment.state, "paid");
  assert.equal(h.stats().releases, 0);
  assert.equal(h.stats().confirmations, 1);
  assert.equal(h.stats().audits, 1);
});

test("unauthorized operators cannot query provider or write audit; missing provider orders stay held", async () => {
  const denied = harness(() => ({ orderStatus: 4 }), false);
  assert.equal((await denied.invoke("post /api/admin/redotpay/attempts/:id/reconcile")).status, 403);
  assert.equal(denied.stats().calls, 0);
  assert.equal(denied.stats().audits, 0);
  const uncertain = harness(() => { throw new Error("Provider order not found"); });
  const result = await uncertain.invoke("post /api/admin/redotpay/attempts/:id/reconcile", { body: { action: "close", reason: "Recover timeout" } });
  assert.equal(result.status, 400);
  assert.equal(uncertain.payment.state, "pending");
  assert.equal(uncertain.stats().releases, 0);
  assert.equal(uncertain.stats().audits, 1);
});