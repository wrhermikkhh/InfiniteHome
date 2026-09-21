import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { calculateQuote, registerRedotPay } from "../shared/redotpay-routes";
import { config, matchesPayment, providerRequest, publicOrigin, usdCents, verifyWebhook, SANDBOX_PUBLIC_KEY, PRODUCTION_PUBLIC_KEY } from "../shared/redotpay";
import { PgDialect } from "drizzle-orm/pg-core";
import { BROWSER_ID_COOKIE, getBrowserIdentity, getReservationOwner, transportPeerBucket } from "../shared/request-identity";
import { changeInventory } from "../shared/inventory";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const product = { id: "p1", name: "Pillow", price: 210, stock: 10, express_charge: 21, variants: [], colors: [], category: "Bedding" };
const input = { items: [{ productId: "p1", qty: 2 }], deliveryType: "male", shippingSpeed: "standard" };

test("MVR / 15.42 rounds once to USD cents; rejects invalid totals", () => {
  assert.equal(usdCents(15420), 1000);
  assert.equal(usdCents(21000), 1362);
  assert.equal(usdCents(10000), 649);
  assert.equal(usdCents(1100), 71);
  for (const value of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => usdCents(value));
});
test("server quote ignores forged prices, totals, shipping and discounts", () => {
  const q = calculateQuote({ ...input, subtotal: 1, shipping: -99, total: 1, discount: 999 }, [product]);
  assert.equal(q.total, 420);
  assert.equal(q.usdCents, 2724);
  assert.equal(Object.hasOwn(q, "rate"), false);
  assert.equal(calculateQuote({ ...input, shippingSpeed: "express" }, [product]).total, 462);
  assert.equal(calculateQuote({ ...input, deliveryType: "boat", shippingSpeed: "express" }, [product]).shipping, 0);
});
test("coupons use server eligibility and preorder deposit prices", () => {
  const coupon = { status: "active", scope: "category", allowed_categories: ["Bedding"], discount: 10, type: "percentage" };
  assert.equal(calculateQuote({ ...input, couponCode: "SAVE" }, [product], coupon).total, 378);
  assert.throws(() => calculateQuote({ ...input, couponCode: "FORGED" }, [product]), /Coupon/);
  const p = { ...product, is_pre_order: true, pre_order_initial_payment: 42, pre_order_price: 210 };
  const pre = { ...input, couponCode: "SAVE", items: [{ productId: "p1", qty: 2, isPreOrder: true }] };
  assert.equal(calculateQuote(pre, [p], coupon).total, 84);
  assert.equal(calculateQuote(pre, [p], { ...coupon, allow_pre_order: true }).total, 75.6);
});
test("quantity, missing product, variant, expired preorder validation", () => {
  for (const qty of [-1, 0, 1.5, 101]) assert.throws(() => calculateQuote({ ...input, items: [{ productId: "p1", qty }] }, [product]));
  assert.throws(() => calculateQuote(input, []));
  assert.throws(() => calculateQuote(input, [{ ...product, colors: ["White"] }]));
  assert.throws(() => calculateQuote({ ...input, items: [{ productId: "p1", qty: 1, isPreOrder: true }] }, [{ ...product, is_pre_order: true, pre_order_deadline: "2020-01-01" }]));
});
test("variant sale price matches storefront proportional sale", () => {
  const p = { ...product, is_on_sale: true, sale_price: 105, variants: [{ size: "Large", price: 420 }] };
  assert.equal(calculateQuote({ ...input, items: [{ productId: "p1", size: "Large", qty: 1 }] }, [p]).total, 210);
});
test("public callback origin cannot derive from headers or unsafe URL", () => {
  assert.equal(publicOrigin("https://shop.example.com/"), "https://shop.example.com");
  for (const value of [undefined, "http://example.com", "https://localhost", "https://127.0.0.1", "https://example.com/path", "https://user:pass@example.com", "https://example.com?x=y"]) assert.throws(() => publicOrigin(value));
  assert.throws(() => config({}), /disabled/);
});
test("request adapter signs exact body and documented URI; mocked transport only", async () => {
  const settings = { origin: "https://shop.example.com", key: privateKey, appKey: "test-app-key", version: "1" };
  const fetcher = (async (url: any, options: any) => {
    assert.equal(url, "https://acquirer.redotpay.com/openapi/v2/order/create");
    assert.equal(options.redirect, "error");
    const h = options.headers;
    assert.equal(h["X-R-AK"], settings.appKey);
    assert.equal(verify("RSA-SHA256", Buffer.from(`POST /openapi/v2/order/create\n${settings.appKey}.${h["X-R-Ts"]}.${options.body}`), publicKey, Buffer.from(h["X-R-Signature"], "base64")), true);
    assert.equal(JSON.parse(options.body).orderCurrency, "USD");
    return new Response(JSON.stringify({ code: "SUCCESS", data: { orderSn: "provider-1" } }));
  }) as typeof fetch;
  assert.deepEqual(await providerRequest("/openapi/v2/order/create", { orderAmount: 10, orderCurrency: "USD" }, fetcher, settings), { orderSn: "provider-1" });
  await assert.rejects(providerRequest("/openapi/v2/order/detail", {}, (async () => new Response(JSON.stringify({ code: "FAIL", msg: "sensitive provider data" }))) as typeof fetch, settings), /did not confirm/);
});
test("webhook verification preserves raw bytes and rejects tampering/version/appKey", () => {
  const timestamp = String(Date.now());
  const raw = Buffer.from('{ "outerOrderSn": "RP1", "orderStatus": 2 }');
  const signature = sign("RSA-SHA256", Buffer.concat([Buffer.from(`app.${timestamp}.`), raw]), privateKey).toString("base64");
  assert.equal(verifyWebhook(raw, timestamp, signature, "1", "app", publicPem), true);
  assert.equal(verifyWebhook(Buffer.from(JSON.stringify(JSON.parse(raw.toString()))), timestamp, signature, "1", "app", publicPem), false);
  assert.equal(verifyWebhook(raw, timestamp, signature, "2", "app", publicPem), false);
  assert.equal(verifyWebhook(raw, timestamp, signature, "1", "forged", publicPem), false);
});
test("authoritative details must match immutable currency, amount and identities", () => {
  const expected = { id: "RP1", usd_cents: 1000, provider_id: "p1" };
  const detail = { outerOrderSn: "RP1", orderSn: "p1", orderCurrency: "USD", orderAmount: "10.00" };
  assert.ok(matchesPayment(detail, expected));
  for (const forged of [{ orderCurrency: "MVR" }, { orderAmount: 1 }, { outerOrderSn: "OTHER" }, { orderSn: "OTHER" }]) assert.equal(matchesPayment({ ...detail, ...forged }, expected), false);
});
test("shared route integration blocks legacy payment creation and status bypass for both DB driver shapes", async () => {
  for (const nodePg of [true, false]) {
    const routes: Record<string, any> = {};
    const app: any = Object.fromEntries(["get", "post", "use"].map(method => [method, (path: string, handler: any) => { routes[`${method} ${path}`] = handler; }]));
    let method = "redotpay";
    registerRedotPay(app, () => ({ execute: async () => nodePg ? { rows: [{ payment_method: method }] } : [{ payment_method: method }] }), {});
    let status = 200, nextCalled = false;
    const res: any = { status: (s: number) => { status = s; return res; }, json: () => res };
    await routes["post /api/orders"]({ body: { paymentMethod: "redotpay", status: "confirmed" } }, res, () => { nextCalled = true; });
    assert.equal(status, 400); assert.equal(nextCalled, false);
    await routes["use /api/orders/:id"]({ method: "PATCH", params: { id: "order" } }, res, () => { nextCalled = true; });
    assert.equal(status, 403); assert.equal(nextCalled, false);
    method = "cod";
    await routes["use /api/orders/:id"]({ method: "PATCH", params: { id: "order" } }, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  }
});

test("mocked reconciliation confirms once, never deducts stock twice; migration failures fail closed", async () => {
  for (const nodePg of [true, false]) {
    const routes: Record<string, any> = {};
    const app: any = Object.fromEntries(["get", "post", "use"].map(method => [method, (path: string, handler: any) => { routes[`${method} ${path}`] = handler; }]));
    const payment = { id: "RP1", usd_cents: 1000, state: "pending", order_id: "o1", provider_id: "provider1", payload: { total: 210 }, allocations: [], expires_at: new Date() };
    const dialect = new PgDialect();
    let confirmations = 0, stockWrites = 0, missingMigration = false;
    const db: any = {
      execute: async (query: any) => {
        const { sql: command } = dialect.sqlToQuery(query);
        let result: any[] = [];
        if (command.includes("INSERT INTO redotpay_limits")) result = [{ hits: 1 }];
        else if (command.includes("FROM redotpay_schema")) {
          if (missingMigration) throw new Error("relation missing");
          assert.match(command, /version = 2/);
          result = [{ version: 2 }];
        } else if (command.includes("INSERT INTO redotpay_limits")) result = [{ hits: 1 }];
        else if (command.startsWith("SELECT") && command.includes("FROM redotpay_payments") && !command.includes("LIMIT 0")) result = [{ ...payment }];
        else if (command.startsWith("UPDATE orders")) confirmations++;
        else if (command.startsWith("UPDATE products")) stockWrites++;
        else if (command.includes("SET state = 'paid'")) payment.state = "paid";
        return nodePg ? { rows: result } : result;
      },
      transaction: async (fn: any) => fn(db),
    };
    registerRedotPay(app, () => db, {}, {
      configure: () => ({ origin: "https://shop.example.com", key: privateKey, appKey: "test-app-key", version: "1" }),
      request: async () => ({ outerOrderSn: "RP1", orderSn: "provider1", orderAmount: 10, orderCurrency: "USD", orderStatus: 2 }),
    });
    let output: any;
    const res: any = { append: () => res, status: () => res, json: (data: any) => { output = data; return res; } };
    const req: any = { get: () => `Bearer ${"a".repeat(64)}` };
    await routes["post /api/payments/redotpay/status"](req, res);
    assert.equal(output.state, "paid");
    await routes["post /api/payments/redotpay/status"](req, res);
    assert.equal(confirmations, 1);
    assert.equal(stockWrites, 0);
    missingMigration = true;
    await routes["get /api/payments/redotpay/readiness"]({}, res);
    assert.equal(output.available, false);
    assert.match(output.message, /migration/);
  }
});

test("sandbox uses documented host and a separate pinned key; signatures are never disabled", async () => {
  const settings = config({ REDOTPAY_ENABLED: "true", REDOTPAY_PUBLIC_ORIGIN: "https://shop.example.com",
    REDOTPAY_ENVIRONMENT: "sandbox", REDOTPAY_MVR_PER_USD: "15.42", REDOTPAY_APP_KEY: "fake",
    REDOTPAY_KEY_VERSION: "1", REDOTPAY_PRIVATE_KEY: privateKey.export({ format: "pem", type: "pkcs8" }).toString() });
  assert.equal(settings.apiOrigin, "https://acquirersandbox.rp-2023app.com");
  assert.equal(settings.webhookKey, SANDBOX_PUBLIC_KEY);
  assert.notEqual(SANDBOX_PUBLIC_KEY, PRODUCTION_PUBLIC_KEY);
  await providerRequest("/openapi/v2/order/detail", { outerOrderSn: "fake" }, (async (url: any, options: any) => {
    assert.equal(url, "https://acquirersandbox.rp-2023app.com/openapi/v2/order/detail");
    assert.ok(options.headers["X-R-Signature"]);
    return new Response(JSON.stringify({ code: "SUCCESS", data: {} }));
  }) as typeof fetch, settings);
  assert.equal(verifyWebhook(Buffer.from("{}"), String(Date.now()), "", "1", "fake", SANDBOX_PUBLIC_KEY), false);
});

// In-memory SQL harness: both deployment drivers, no network, DB, credentials or mail.
function recoveryFixture(nodePg: boolean, initialState = "pending", lockProduct?: (id: string) => Promise<() => void>) {
  const routes: Record<string, any> = {};
  const app: any = Object.fromEntries(["get", "post", "use"].map(method => [method, (path: string, handler: any) => { routes[`${method} ${path}`] = handler; }]));
  const p: any = { id: "RP1", usd_cents: 1000, rate: "15.4200", state: initialState, provider_id: "provider1", order_id: "o1",
    allocations: [{ productId: "p1", qty: 1 }], payload: { total: 154.2, trackingNumber: "202601010000001001" }, expires_at: new Date(0) };
  let providerStatus = 4, detailMismatch = false, stockWrites = 0, hits = 1, orderStatus = "confirmed";
  let admin: any = { id: "a1", isSuperAdmin: true, permissions: {} };
  const events: any[] = [], calls: string[] = [], queries: any[] = [];
  const dialect = new PgDialect();
  const unlocks: (() => void)[] = [];
  const db: any = { execute: async (q: any) => {
    const { sql: s, params } = dialect.sqlToQuery(q);
    queries.push({ sql: s, params });
    let result: any[] = [];
    if (s.includes("INSERT INTO redotpay_limits")) result = [{ hits }];
    else if (s.startsWith("INSERT INTO redotpay_audit")) events.push(params);
    else if (s.startsWith("SELECT") && s.includes("FROM redotpay_payments")) result = [{ ...p }];
    else if (s.startsWith("SELECT") && s.includes("FROM products")) {
      if (lockProduct) unlocks.push(await lockProduct(params[0] as string));
      result = [{ id: params[0], stock: 2 }];
    }
    else if (s.startsWith("SELECT") && s.includes("FROM orders")) result = [{ status: orderStatus }];
    else if (s.startsWith("UPDATE products")) stockWrites++;
    else if (s.includes("SET state = 'closed'")) p.state = "closed";
    else if (s.includes("SET state = 'paid'")) p.state = "paid";
    else if (s.startsWith("UPDATE orders") && s.includes("status = $")) orderStatus = params[0] as string;
    return nodePg ? { rows: result } : result;
  }, transaction: async (fn: any) => {
    try { return await fn(db); }
    finally { while (unlocks.length) unlocks.pop()!(); }
  } };
  registerRedotPay(app, () => db, {}, {
    configure: () => ({ origin: "https://shop.example.com", key: privateKey, appKey: "fake", version: "1", webhookKey: publicPem }),
    request: async (path) => {
      calls.push(path);
      if (path.endsWith("/close")) return {};
      return { outerOrderSn: "RP1", orderSn: "provider1", orderAmount: detailMismatch ? 11 : 10, orderCurrency: "USD", orderStatus: providerStatus };
    },
  });
  async function invoke(route: string, body: any = {}, headers: any = {}, extra: any = {}) {
    let status = 200, output: any;
    const req: any = { method: route.startsWith("get") ? "GET" : "POST", body, params: { id: "RP1" }, ip: "127.0.0.1",
      get: (key: string) => ({ authorization: `Bearer ${"a".repeat(64)}`, origin: "https://shop.example.com", ...headers })[key.toLowerCase()], ...extra };
    const res: any = { locals: { admin }, append: () => res, status: (s: number) => { status = s; return res; }, json: (data: any) => { output = data; return res; } };
    await routes[route](req, res);
    return { status, output };
  }
  return { invoke, p, calls, events, queries, stockWrites: () => stockWrites, orderStatus: () => orderStatus,
    provider: (s: number) => { providerStatus = s; }, mismatch: () => { detailMismatch = true; },
    throttle: () => { hits = 99999; }, admin: (value: any) => { admin = value; } };
}

test("authoritative closure releases once; paid/unknown/mismatched results never release", async () => {
  for (const nodePg of [true, false]) {
    const f = recoveryFixture(nodePg);
    assert.equal((await f.invoke("post /api/payments/redotpay/cancel")).output.state, "closed");
    await f.invoke("post /api/payments/redotpay/status");
    assert.equal(f.stockWrites(), 1);
    const paid = recoveryFixture(nodePg); paid.provider(2);
    assert.equal((await paid.invoke("post /api/payments/redotpay/cancel")).output.state, "paid");
    assert.equal(paid.stockWrites(), 0);
    assert.equal(paid.calls.some(c => c.endsWith("/close")), false);
    const unknown = recoveryFixture(nodePg); unknown.provider(1);
    await unknown.invoke("post /api/payments/redotpay/cancel");
    assert.equal(unknown.stockWrites(), 0);
    const mismatch = recoveryFixture(nodePg); mismatch.mismatch();
    assert.equal((await mismatch.invoke("post /api/payments/redotpay/cancel")).status, 400);
    assert.equal(mismatch.stockWrites(), 0);
  }
});

test("rate limits are shared DB decisions and prevent provider calls", async () => {
  const f = recoveryFixture(true); f.throttle();
  for (const action of ["quote", "create", "status", "cancel"]) {
    assert.equal((await f.invoke(`post /api/payments/redotpay/${action}`)).status, 429);
  }
  assert.equal(f.calls.length, 0);
});

test("active reservation caps stop rotating capabilities before stock writes (both drivers)", async () => {
  for (const nodePg of [true, false]) for (const count of [{ total: 100, owned: 0 }, { total: 2, owned: 2 }]) {
    const routes: Record<string, any> = {};
    const app: any = Object.fromEntries(["get", "post", "use"].map(method => [method, (path: string, handler: any) => { routes[`${method} ${path}`] = handler; }]));
    const dialect = new PgDialect();
    const commands: string[] = [];
    const db: any = { execute: async (q: any) => {
      const { sql: s } = dialect.sqlToQuery(q); commands.push(s);
      const result = s.includes("INSERT INTO redotpay_limits") ? [{ hits: 1 }] :
        s.includes("FROM redotpay_schema") ? [{ version: 2 }] :
        s.includes("count(*)") ? [count] : [];
      return nodePg ? { rows: result } : result;
    }, transaction: async (fn: any) => fn(db) };
    registerRedotPay(app, () => db, {}, {
      configure: () => ({ origin: "https://shop.example.com", key: privateKey, appKey: "fake", version: "1" }),
      request: async () => { throw new Error("Provider must not be called"); },
    });
    let output: any;
    const res: any = { append: () => res, status: () => res, json: (data: any) => { output = data; return res; } };
    await routes["post /api/payments/redotpay/create"]({ ip: "127.0.0.1", body: input, get: () => `Bearer ${"a".repeat(64)}` }, res);
    assert.match(output.message, /reservation limit/);
    assert.equal(commands.some(s => s.startsWith("UPDATE products")), false);
    assert.equal(commands.some(s => s.includes("INSERT INTO redotpay_payments")), false);
  }
});

test("operator requires DB permission and origin; cannot forge payment or refund; paid fulfillment is audited", async () => {
  const route = "post /api/admin/redotpay/:id/action";
  const f = recoveryFixture(false);
  assert.equal((await f.invoke(route, { action: "fulfill", status: "delivered" })).status, 400);
  f.p.state = "paid";
  for (const status of ["paid", "cancelled", "refunded", "payment_pending"]) assert.equal((await f.invoke(route, { action: "fulfill", status })).status, 400);
  assert.equal((await f.invoke(route, { action: "fulfill", status: "processing" })).status, 200);
  assert.equal(f.orderStatus(), "processing");
  assert.ok(f.events.some(e => e.includes("admin:a1") && e.includes("processing")));
  assert.equal(f.stockWrites(), 0);
  assert.equal((await f.invoke(route, { action: "reconcile" }, { origin: "https://attacker.example" })).status, 403);
  f.admin(null);
  assert.equal((await f.invoke(route, { action: "reconcile" })).status, 403);
  f.admin({ id: "a2", isSuperAdmin: false, permissions: { canManageOrders: false } });
  assert.equal((await f.invoke(route, { action: "reconcile" })).status, 403);
});

test("bounded recovery retains uncertain reservations and audits failures", async () => {
  const f = recoveryFixture(true, "unknown"); f.mismatch();
  const result = await f.invoke("post /api/admin/redotpay/recover");
  assert.equal(result.output.processed, 1);
  assert.equal(result.output.results[0].state, "unresolved");
  assert.equal(f.stockWrites(), 0);
  assert.ok(f.events.some(e => e.includes("unresolved; reservation retained")));
  assert.equal((await f.invoke("get /api/payments/redotpay/recover")).status, 401);
});

test("raw-body callback smoke fixture: delayed/repeated signed bytes accepted, missing/mutated raw bytes rejected", async () => {
  for (const nodePg of [true, false]) {
    const f = recoveryFixture(nodePg);
    const body = { actionType: "ACQUIRER_PAY", outerOrderSn: "RP1" };
    const raw = Buffer.from('{\n "actionType": "ACQUIRER_PAY", "outerOrderSn": "RP1"\n}');
    const timestamp = String(Date.now() - 86400000);
    const signature = sign("RSA-SHA256", Buffer.concat([Buffer.from(`fake.${timestamp}.`), raw]), privateKey).toString("base64");
    const headers = { "x-r-ts": timestamp, "x-r-signature": signature, "x-r-key-version": "1" };
    const path = "post /api/payments/redotpay/webhook";
    assert.equal((await f.invoke(path, body, headers)).status, 401);
    assert.equal((await f.invoke(path, body, headers, { rawBody: Buffer.from(JSON.stringify(body)) })).status, 401);
    assert.equal((await f.invoke(path, body, headers, { rawBody: raw })).status, 200);
    assert.equal((await f.invoke(path, body, headers, { rawBody: raw })).status, 200);
    assert.equal(f.stockWrites(), 1);
  }
});

test("release cart [B,A,B] prelocks distinct [A,B], matching legacy cart [A,B] and reverse order", async () => {
  for (const nodePg of [true, false]) {
    for (const cart of [["B", "A", "B"], ["A", "B"]]) {
      const f = recoveryFixture(nodePg);
      f.p.allocations = cart.map(productId => ({ productId, qty: 1 }));
      assert.equal((await f.invoke("post /api/payments/redotpay/cancel")).output.state, "closed");
      const locks = f.queries.filter(q => q.sql.startsWith("SELECT") && q.sql.includes("FROM products"));
      assert.deepEqual(locks.map(q => q.params[0]), ["A", "B"]);
      const firstWrite = f.queries.findIndex(q => q.sql.startsWith("UPDATE products"));
      assert.ok(locks.every(q => f.queries.indexOf(q) < firstWrite));
      const legacyLocks: string[] = [];
      const dialect = new PgDialect();
      await changeInventory({ execute: async (query: any) => {
        const { sql: command, params } = dialect.sqlToQuery(query);
        if (!command.startsWith("SELECT")) return nodePg ? { rows: [] } : [];
        legacyLocks.push(params[0] as string);
        const products = [{ id: params[0], stock: 10 }];
        return nodePg ? { rows: products } : products;
      } }, ["A", "B"].map(productId => ({ productId, qty: 1 })));
      assert.deepEqual(legacyLocks, locks.map(q => q.params[0]));
      await f.invoke("post /api/payments/redotpay/status");
      assert.equal(f.stockWrites(), cart.length, "terminal replay must not release twice");
    }
  }
});

test("server-issued browser owners distinguish clients behind one proxy; cookies persist and forged headers do not change ownership", async () => {
  for (const nodePg of [true, false]) {
    const identities = new Map<string, any>();
    const dialect = new PgDialect();
    const db = { execute: async (query: any) => {
      const { sql: command, params } = dialect.sqlToQuery(query);
      let result: any[] = [];
      if (command.startsWith("INSERT INTO request_browser_identities")) identities.set(params[0] as string, { token_hash: params[0] });
      else if (command.includes("FROM request_browser_identities")) result = identities.has(params[0] as string) ? [identities.get(params[0] as string)] : [];
      else if (command.includes("FROM customer_sessions")) result = [{ id: "authenticated-customer-1" }];
      return nodePg ? { rows: result } : result;
    } };
    function browser() {
      const req: any = { headers: {}, secure: true, ip: "shared-proxy", socket: { remoteAddress: "10.0.0.1" } };
      const cookies: string[] = [];
      const res: any = { append: (_name: string, cookie: string) => { cookies.push(cookie); req.headers.cookie = cookie.split(";")[0]; } };
      return { req, res, cookies };
    }
    const a = browser(), b = browser();
    const ownerA = await getReservationOwner(a.req, a.res, db);
    const ownerB = await getReservationOwner(b.req, b.res, db);
    assert.notEqual(ownerA, ownerB);
    assert.equal(identities.size, 2);
    assert.match(a.cookies[0], /HttpOnly; SameSite=Strict; Max-Age=7776000; Secure/);
    assert.equal(await getReservationOwner(a.req, a.res, db), ownerA);
    a.req.headers["x-forwarded-for"] = "attacker-selected";
    a.req.headers["x-real-ip"] = "attacker-selected";
    a.req.ip = "spoofed-express-ip";
    assert.equal(await getReservationOwner(a.req, a.res, db), ownerA);
    assert.equal(transportPeerBucket(a.req), transportPeerBucket(b.req));
    a.req.headers.cookie = `${BROWSER_ID_COOKIE}=${"a".repeat(64)}`;
    const replaced = await getBrowserIdentity(a.req, a.res, db);
    assert.ok(identities.has(replaced));
    assert.equal(a.cookies.length, 2, "arbitrary valid-looking cookies are replaced, not trusted");
    a.req.headers.cookie += `; veltrix_customer_session=${"b".repeat(64)}`;
    b.req.headers.cookie += `; veltrix_customer_session=${"c".repeat(64)}`;
    assert.equal(await getReservationOwner(a.req, a.res, db), await getReservationOwner(b.req, b.res, db),
      "valid sessions for the same DB customer share the stronger account cap");
  }
});

test("concurrent reversed-cart reconciliation and legacy [A,B] checkout complete without a lock cycle", async () => {
  for (const nodePg of [true, false]) {
    const queues = new Map<string, Promise<void>>();
    async function lock(id: string) {
      const previous = queues.get(id) || Promise.resolve();
      let unlock!: () => void;
      queues.set(id, new Promise<void>(resolve => { unlock = resolve; }));
      await previous;
      // Yield while holding the lock so reversed first-lock acquisition would
      // expose a cycle rather than accidentally completing serially.
      await new Promise<void>(resolve => setImmediate(resolve));
      return unlock;
    }
    const reverse = recoveryFixture(nodePg, "pending", lock);
    const forward = recoveryFixture(nodePg, "pending", lock);
    reverse.p.allocations = ["B", "A"].map(productId => ({ productId, qty: 1 }));
    forward.p.allocations = ["A", "B"].map(productId => ({ productId, qty: 1 }));
    const held: (() => void)[] = [];
    const dialect = new PgDialect();
    const legacy = (async () => {
      try {
        await changeInventory({ execute: async (query: any) => {
          const { sql: command, params } = dialect.sqlToQuery(query);
          if (!command.startsWith("SELECT")) return nodePg ? { rows: [] } : [];
          held.push(await lock(params[0] as string));
          const products = [{ id: params[0], stock: 10 }];
          return nodePg ? { rows: products } : products;
        } }, ["A", "B"].map(productId => ({ productId, qty: 1 })));
      } finally { while (held.length) held.pop()!(); }
    })();
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        Promise.all([legacy, reverse.invoke("post /api/payments/redotpay/cancel"), forward.invoke("post /api/payments/redotpay/cancel")]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Product lock cycle detected")), 1000); }),
      ]);
      assert.equal(reverse.p.state, "closed");
      assert.equal(forward.p.state, "closed");
      assert.equal(reverse.stockWrites(), 2);
      assert.equal(forward.stockWrites(), 2);
    } finally { clearTimeout(timer!); }
  }
});
