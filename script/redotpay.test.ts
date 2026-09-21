import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { calculateQuote, registerRedotPay } from "../shared/redotpay-routes";
import { config, matchesPayment, providerRequest, publicOrigin, usdCents, verifyWebhook } from "../shared/redotpay";
import { PgDialect } from "drizzle-orm/pg-core";

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
  assert.equal(q.rate, 15.42);
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
    const app: any = {
      get: (path: string, handler: any) => { routes[`GET ${path}`] = handler; },
      post: (path: string, handler: any) => { routes[`POST ${path}`] = handler; },
      use: (path: string, handler: any) => { routes[`USE ${path}`] = handler; },
    };
    let method = "redotpay";
    registerRedotPay(app, () => ({ execute: async () => nodePg ? { rows: [{ payment_method: method }] } : [{ payment_method: method }] }), {});
    let status = 200, nextCalled = false;
    const res: any = { status: (s: number) => { status = s; return res; }, json: () => res };
    await routes["POST /api/orders"]({ body: { paymentMethod: "redotpay", status: "confirmed" } }, res, () => { nextCalled = true; });
    assert.equal(status, 400); assert.equal(nextCalled, false);
    await routes["USE /api/orders/:id"]({ method: "PATCH", params: { id: "order" } }, res, () => { nextCalled = true; });
    assert.equal(status, 403); assert.equal(nextCalled, false);
    method = "cod";
    await routes["USE /api/orders/:id"]({ method: "PATCH", params: { id: "order" } }, res, () => { nextCalled = true; });
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
        if (command.includes("FROM redotpay_schema")) {
          if (missingMigration) throw new Error("relation missing");
          result = [{ version: 1 }];
        } else if (command.startsWith("SELECT") && command.includes("FROM redotpay_payments") && !command.includes("LIMIT 0")) result = [{ ...payment }];
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
    const res: any = { status: () => res, json: (data: any) => { output = data; return res; } };
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