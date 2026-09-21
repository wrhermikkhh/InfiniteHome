// Shared by Express development and Vercel. No dependency on either DB driver.
import type { Express, Request, Response } from "express";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getReservationOwner, transportPeerBucket } from "./request-identity.js";
import { isIP } from "node:net";
import { acceptanceWebhookConfig, checkoutBrowserFields, config, matchesPayment, providerRequest, usdCents, verifyWebhook, REDOTPAY_RATE } from "./redotpay.js";

const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const money = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000000) throw new Error("Invalid product price");
  return Math.round(value * 100);
};
const text = (value: unknown, max = 200) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Missing or invalid checkout details");
  return value.trim();
};

export const RESERVATION_LIMITS = { networkActive: 3, networkHourly: 10, globalActive: 100, globalHourly: 200 };
export function providerCheckoutUrl(result: any, environment: "WEB" | "H5" | "APP") {
  const raw = environment === "APP" ? result?.appUrl : result?.webUrl;
  if (typeof raw !== "string" || !raw || raw.length > 2048) throw new Error("Invalid provider checkout response");
  const url = new URL(raw);
  const protocols = environment === "APP" ? ["https:", "redotpay:", "intent:", "app:"] : ["https:"];
  if (!protocols.includes(url.protocol) || url.username || url.password) throw new Error("Invalid provider checkout response");
  return url.href;
}

export function calculateQuote(input: any, products: any[], coupon: any = null) {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw new Error("Invalid cart");
  if (!["male", "hulhumale", "boat"].includes(input.deliveryType) || !["standard", "express"].includes(input.shippingSpeed)) throw new Error("Invalid delivery option");
  let subtotal = 0, shipping = 0, eligible = 0;
  const items = input.items.map((item: any) => {
    if (!Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 100) throw new Error("Invalid quantity");
    const p = products.find(p => p.id === item.productId);
    if (!p || p.show_on_storefront === false) throw new Error("Product is unavailable");
    const size = text(item.size || "Standard", 80), color = text(item.color || "Default", 80);
    const variant = (p.variants || []).find((v: any) => v.size === size);
    if ((p.variants?.length && !variant) || (p.colors?.length && !p.colors.includes(color))) throw new Error("Invalid product option");
    const preOrder = item.isPreOrder === true;
    if (preOrder && (!p.is_pre_order || (p.pre_order_deadline && new Date().toISOString().slice(0, 10) >= p.pre_order_deadline))) throw new Error("Pre-order is unavailable");
    if (p.max_order_qty && input.items.filter((i: any) => i.productId === p.id).reduce((n: number, i: any) => n + i.qty, 0) > p.max_order_qty) throw new Error("Maximum order quantity exceeded");
    let price = variant ? variant.price : p.price;
    if (p.is_on_sale) {
      if (p.sale_percent) price = price * (1 - p.sale_percent / 100);
      else if (p.sale_price && p.price > 0) price = price * p.sale_price / p.price;
    }
    if (preOrder) price = p.pre_order_initial_payment || price;
    const unit = money(price), amount = unit * item.qty;
    subtotal += amount;
    if (input.shippingSpeed === "express" && input.deliveryType !== "boat") shipping += money(p.express_charge || 0) * item.qty;
    if (coupon && (!preOrder || coupon.allow_pre_order) && (coupon.scope === "store" ||
      (coupon.scope === "category" && coupon.allowed_categories?.includes(p.category)) ||
      (coupon.scope === "product" && coupon.allowed_products?.includes(p.id)))) eligible += amount;
    return { productId: p.id, name: p.name, qty: item.qty, price: unit / 100, size, color, isPreOrder: preOrder,
      ...(preOrder ? { preOrderTotalPrice: money(p.pre_order_price ?? p.price) / 100, preOrderEta: p.pre_order_eta } : {}) };
  });
  let discount = 0;
  if (input.couponCode) {
    if (!coupon || coupon.status !== "active") throw new Error("Coupon is invalid or expired");
    discount = Math.min(eligible, coupon.type === "percentage" ? Math.round(eligible * Math.min(100, money(coupon.discount) / 100) / 100) : money(coupon.discount));
  }
  const totalCents = subtotal - discount + shipping;
  const cents = usdCents(totalCents);
  // Provider goodsAmount supports at most 10,000 USD; use one basket line.
  if (cents > 1000000) throw new Error("Order exceeds the hosted checkout limit");
  return { items, subtotal: subtotal / 100, discount: discount / 100, shipping: shipping / 100, total: totalCents / 100, usdCents: cents };
}

export function registerRedotPay(app: Express, getDb: () => any, ordersTable: any,
  dependencies: RedotPayDependencies = {}) {
  // Disabling new checkouts must not disable signed callbacks or recovery.
  const configure = dependencies.configure || (() => config({ ...process.env, REDOTPAY_ENABLED: "true" }));
  const request = dependencies.request || ((path, payload) => providerRequest(path, payload, fetch, configure()));
  async function readiness() {
    try {
      if (!dependencies.configure) config();
      else configure();
      const result = rows(await getDb().execute(sql`SELECT version FROM redotpay_schema WHERE version = 2`));
      if (!result.length) throw new Error();
      await getDb().execute(sql`SELECT id, token_hash, usd_cents, rate, owner_hash, recovery_after, state, allocations, order_id, payload, provider_id, checkout_url, expires_at FROM redotpay_payments LIMIT 0`);
      await getDb().execute(sql`SELECT key, hits, reset_at FROM redotpay_limits LIMIT 0`);
      await getDb().execute(sql`SELECT token_hash, expires_at FROM request_browser_identities LIMIT 0`);
      await getDb().execute(sql`SELECT payment_id, actor, action, outcome FROM redotpay_audit LIMIT 0`);
      await getDb().execute(sql`SELECT id, actor_id, payment_id, action, reason, outcome, created_at, completed_at FROM redotpay_operator_audit LIMIT 0`);
      return { available: true, currency: "USD", message: "" };
    } catch (error: any) {
      const message = /RedotPay|REDOTPAY/.test(error.message) ? error.message : "RedotPay payment migration is missing or unavailable";
      return { available: false, currency: "USD", message };
    }
  }
  const handle = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (error: any) {
      // Never return provider payloads, DB errors, signatures or keys.
      const safe = /^(Invalid|Missing|Product|Pre-order|Maximum|Coupon|Order |Stock |RedotPay|Payment |Checkout |No payment)/.test(error.message || "");
      res.status(error.status || 400).json({ message: safe ? error.message : "Payment request could not be completed. Check status before retrying." });
    }
  };
  async function ready() {
    const status = await readiness();
    if (!status.available) throw new Error(status.message);
  }
  async function limit(key: string, max: number, seconds = 60) {
    const result = rows(await getDb().execute(sql`INSERT INTO redotpay_limits(key, hits, reset_at)
      VALUES (${key}, 1, now() + ${seconds} * interval '1 second')
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN redotpay_limits.reset_at <= now() THEN 1 ELSE redotpay_limits.hits + 1 END,
        reset_at = CASE WHEN redotpay_limits.reset_at <= now() THEN now() + ${seconds} * interval '1 second' ELSE redotpay_limits.reset_at END
      RETURNING hits`));
    if (!result.length || result[0].hits > max) throw Object.assign(new Error("Payment request limit reached. Please wait before retrying."), { status: 429 });
  }
  async function throttle(req: Request, res: Response, action: string, max: number) {
    // Apply non-resettable global/transport budgets before issuing identities.
    await limit(`global:${action}`, max * 20);
    await limit(`peer:${action}:${transportPeerBucket(req)}`, max * 20);
    const owner = await getReservationOwner(req, res, getDb());
    await limit(`${action}:${owner}`, max);
    return owner;
  }
  async function operator(req: Request, res: Response) {
    const admin = dependencies.authenticateOperator
      ? await dependencies.authenticateOperator(req)
      : isPaymentOperator(res.locals?.admin) ? res.locals.admin : null;
    if (!admin?.id) throw Object.assign(new Error("Payment operator authorization required"), { status: 403 });
    if (req.method !== "GET" && (req.get("origin") !== configure().origin || req.get("sec-fetch-site") === "cross-site")) {
      throw Object.assign(new Error("Invalid operator request origin"), { status: 403 });
    }
    return `admin:${admin.id}`;
  }
  async function audit(id: string | null, actor: string, action: string, outcome: string, db = getDb()) {
    await db.execute(sql`INSERT INTO redotpay_audit(payment_id, actor, action, outcome) VALUES (${id}, ${actor}, ${action}, ${outcome})`);
  }
  async function quote(db: any, input: any, lock = false) {
    const productRows = rows(await db.execute(lock ? sql`SELECT * FROM products ORDER BY id FOR UPDATE` : sql`SELECT * FROM products`));
    let coupon = null;
    if (input.couponCode) coupon = rows(await db.execute(sql`SELECT * FROM coupons WHERE code = ${text(input.couponCode, 100)}`))[0];
    return { quote: calculateQuote(input, productRows, coupon), products: productRows };
  }
  async function authorized(req: Request) {
    const token = req.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Payment authorization required");
    const payment = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE token_hash = ${hash(token)}`))[0];
    if (!payment) throw new Error("No payment found");
    return payment;
  }
  function view(p: any) {
    return { id: p.id, trackingNumber: p.payload.trackingNumber, state: p.state, orderId: p.order_id,
      usdAmount: (p.usd_cents / 100).toFixed(2), expiresAt: p.expires_at,
      checkoutUrl: p.state === "pending" ? p.checkout_url : null,
      reservationPolicy: "Stock is held until RedotPay confirms payment or closure. Closing this page does not cancel payment. Use Cancel and release; uncertain payments stay reserved for reconciliation." };
  }
  function summary(p: any) {
    if (p.state !== "paid") throw Object.assign(new Error("Payment must be confirmed before viewing the order summary"), { status: 409 });
    const payload = p.payload || {};
    return {
      paymentId: p.id,
      orderId: p.order_id,
      orderNumber: payload.orderNumber,
      trackingNumber: payload.trackingNumber,
      status: "confirmed",
      paidAmount: (p.usd_cents / 100).toFixed(2),
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      shippingAddress: payload.shippingAddress,
      deliveryType: payload.deliveryType,
      shippingSpeed: payload.shippingSpeed,
      boatName: payload.boatName,
      boatNumber: payload.boatNumber,
      boatLocation: payload.boatLocation,
      boatAtollIsland: payload.boatAtollIsland,
      notes: payload.notes,
      items: Array.isArray(payload.items) ? payload.items.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        size: item.size,
        color: item.color,
        isPreOrder: item.isPreOrder,
        preOrderEta: item.preOrderEta,
      })) : [],
      confirmedAt: p.updated_at,
    };
  }
  async function release(tx: any, p: any) {
    // Acquire ALL distinct rows in the same ascending ID order as checkout and
    // legacy inventory. Allocation/cart ordering must not determine lock order.
    const products = new Map<string, any>();
    for (const id of Array.from(new Set<string>(p.allocations.map((a: any) => a.productId))).sort()) {
      const product = rows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
      if (!product) throw new Error("Stock reconciliation requires administrator review");
      products.set(id, product);
    }
    for (const a of p.allocations) {
      const product = products.get(a.productId)!;
      if (a.preOrder) {
        const map = product.pre_order_variant_stock || {};
        if (a.key) map[a.key] = (map[a.key] || 0) + a.qty;
        if (a.total) product.pre_order_stock = (product.pre_order_stock ?? 0) + a.qty;
        product.pre_order_variant_stock = map;
        await tx.execute(sql`UPDATE products SET pre_order_stock = ${product.pre_order_stock},
          pre_order_variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${a.productId}`);
      } else if (a.key) {
        const map = product.variant_stock || {};
        map[a.key] = (map[a.key] || 0) + a.qty;
        product.variant_stock = map;
        await tx.execute(sql`UPDATE products SET variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${a.productId}`);
      } else await tx.execute(sql`UPDATE products SET stock = stock + ${a.qty} WHERE id = ${a.productId}`);
    }
  }
  async function reconcile(p: any, actor = "system:reconcile") {
    const detail = await request("/openapi/v2/order/detail", { outerOrderSn: p.id });
    if (!matchesPayment(detail, p)) throw new Error("Payment details do not match; administrator review required");
    return getDb().transaction(async (tx: any) => {
      const current = rows(await tx.execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id} FOR UPDATE`))[0];
      if (!current || !matchesPayment(detail, current)) throw new Error("Payment details changed; administrator review required");
      if (current.state === "paid" || current.state === "closed") return current;
      if (detail.orderStatus === 2) {
        // Stock was reserved exactly once. Never deduct it again on a callback.
        await tx.execute(sql`UPDATE orders SET status = 'confirmed',
          status_history = COALESCE(status_history, '[]'::jsonb) || ${JSON.stringify([{ status: "confirmed", timestamp: new Date().toISOString() }])}::jsonb
          WHERE id = ${current.order_id} AND payment_method = 'redotpay'`);
        await tx.execute(sql`UPDATE redotpay_payments SET state = 'paid', provider_id = ${detail.orderSn}, updated_at = now() WHERE id = ${p.id}`);
        current.state = "paid";
      } else if (detail.orderStatus === 4) {
        await release(tx, current);
        await tx.execute(sql`UPDATE orders SET status = 'cancelled' WHERE id = ${current.order_id} AND payment_method = 'redotpay'`);
        await tx.execute(sql`UPDATE redotpay_payments SET state = 'closed', provider_id = ${detail.orderSn}, updated_at = now() WHERE id = ${p.id}`);
        current.state = "closed";
      } else {
        // Failed child payment is not proof that the parent order cannot be paid.
        const state = detail.orderStatus === 3 ? "failed" : "pending";
        await tx.execute(sql`UPDATE redotpay_payments SET state = ${state}, provider_id = ${detail.orderSn}, updated_at = now() WHERE id = ${p.id}`);
        current.state = state;
      }
      current.provider_id = detail.orderSn;
      await audit(p.id, actor, "reconcile", current.state, tx);
      return current;
    });
  }

  app.get("/api/payments/redotpay/readiness", handle(async (_req, res) => { res.json(await readiness()); }));
  app.post("/api/payments/redotpay/quote", handle(async (req, res) => {
    await throttle(req, res, "quote", 30);
    await ready();
    const result = (await quote(getDb(), req.body)).quote;
    res.json({ usdCents: result.usdCents });
  }));
  app.post("/api/payments/redotpay/create", handle(async (req, res) => {
    const reservationOwner = await throttle(req, res, "create", 6);
    await ready();
    const token = req.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Payment authorization required");
    const tokenHash = hash(token);
    const input = req.body;
    const payment = await getDb().transaction(async (tx: any) => {
      // Serializes retries across serverless instances without trusting client IDs.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${tokenHash}, 0))`);
      const old = rows(await tx.execute(sql`SELECT * FROM redotpay_payments WHERE token_hash = ${tokenHash}`))[0];
      if (old) return old;
      // A shared lock bounds concurrent reservations even across serverless instances.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('redotpay-reservations', 0))`);
      const active = rows(await tx.execute(sql`SELECT
        count(*) FILTER (WHERE state NOT IN ('paid','closed'))::int AS total,
        count(*) FILTER (WHERE owner_hash = ${reservationOwner} AND state NOT IN ('paid','closed'))::int AS owned,
        count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hourly,
        count(*) FILTER (WHERE owner_hash = ${reservationOwner} AND created_at > now() - interval '1 hour')::int AS owner_hourly
        FROM redotpay_payments`))[0];
      if (!active || active.total >= 100 || active.owned >= 2 || active.hourly >= 200 || active.owner_hourly >= 10) {
        throw Object.assign(new Error("Payment reservation limit reached. Recover or close your existing checkout first."), { status: 429 });
      }
      const { quote: q, products } = await quote(tx, input, true);
      if (q.items.reduce((sum: number, item: any) => sum + item.qty, 0) > 20) throw new Error("Maximum hosted payment reservation is 20 units");
      if (input.expectedUsdCents !== q.usdCents) throw new Error("Checkout total changed. Request a new quote before paying.");
      const allocations: any[] = [];
      for (const item of q.items) {
        const p = products.find(p => p.id === item.productId)!;
        const map = (item.isPreOrder ? p.pre_order_variant_stock : p.variant_stock) || {};
        const key = Object.keys(map).find(k => k.toLowerCase() === `${item.size}-${item.color}`.toLowerCase());
        const hasMap = Object.keys(map).length > 0;
        if (hasMap && (!key || map[key] < item.qty)) throw new Error("Stock is no longer available");
        if (item.isPreOrder) {
          if (p.pre_order_stock != null && p.pre_order_stock < item.qty) throw new Error("Pre-order stock is no longer available");
          const total = p.pre_order_stock != null;
          if (total) p.pre_order_stock -= item.qty;
          if (key) map[key] -= item.qty;
          await tx.execute(sql`UPDATE products SET pre_order_stock = ${p.pre_order_stock}, pre_order_variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${p.id}`);
          allocations.push({ productId: p.id, preOrder: true, total, key, qty: item.qty });
        } else {
          if (!hasMap && (p.stock || 0) < item.qty) throw new Error("Stock is no longer available");
          if (key) map[key] -= item.qty; else p.stock -= item.qty;
          await tx.execute(sql`UPDATE products SET stock = ${p.stock}, variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${p.id}`);
          allocations.push({ productId: p.id, preOrder: false, key, qty: item.qty });
        }
      }
      const id = `RP${randomBytes(14).toString("hex")}`;
      const seq = rows(await tx.execute(sql`SELECT nextval('invoice_seq') AS seq`))[0].seq;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
      const timeStr = `${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;
      const payload = { customerName: text(input.customerName), customerEmail: text(input.customerEmail),
        customerPhone: text(input.customerPhone, 50), shippingAddress: text(input.shippingAddress, 1000),
        deliveryType: input.deliveryType, shippingSpeed: input.shippingSpeed,
        notes: typeof input.notes === "string" ? input.notes.slice(0, 1000) : null,
        ...(input.deliveryType === "boat" ? { boatName: text(input.boatName), boatNumber: text(input.boatNumber), boatLocation: text(input.boatLocation), boatAtollIsland: text(input.boatAtollIsland) } : {}),
        items: q.items, subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total,
        couponCode: input.couponCode || null, paymentMethod: "redotpay", status: "payment_pending",
        orderNumber: `ECOM-${dateStr}-${timeStr}-${seq}`, trackingNumber: `${dateStr}${timeStr}${seq}`, statusHistory: [{ status: "payment_pending", timestamp: new Date().toISOString() }] };
      const [order] = await tx.insert(ordersTable).values(payload).returning();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      return rows(await tx.execute(sql`INSERT INTO redotpay_payments (id, token_hash, usd_cents, rate, owner_hash, state, order_id, payload, allocations, expires_at)
        VALUES (${id}, ${tokenHash}, ${q.usdCents}, ${REDOTPAY_RATE}, ${reservationOwner}, 'creating', ${order.id}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(allocations)}::jsonb, ${expiresAt})
        RETURNING *`))[0];
    });
    // Claim once. A crash/timeout is ambiguous: never issue another create.
    const claimed = rows(await getDb().execute(sql`UPDATE redotpay_payments SET state = 'unknown', updated_at = now() WHERE id = ${payment.id} AND state = 'creating' RETURNING *`));
    if (claimed.length) {
      try {
        const settings = configure();
        const checkout = checkoutBrowserFields(settings.origin, req.get("user-agent") || "");
        const result = await request("/openapi/v2/order/create", {
          outerOrderSn: payment.id, outerUid: payment.id, orderAmount: payment.usd_cents / 100,
          orderCurrency: "USD", ...checkout,
          orderDesc: `Store order ${payment.id}`, timeExpire: new Date(payment.expires_at).getTime(),
          goods: [{ goodsType: "01", goodsCategory: "Z000", goodsCode: payment.id.slice(0, 19),
            goodsName: "Store order", goodsCount: 1, goodsAmount: payment.usd_cents / 100, goodsCoin: "USD" }],
        });
        const checkoutUrl = providerCheckoutUrl(result, checkout.env);
        if (result.outerOrderSn !== payment.id || !result.orderSn) throw new Error("Invalid provider checkout response");
        await getDb().execute(sql`UPDATE redotpay_payments SET provider_id = ${result.orderSn}, checkout_url = ${checkoutUrl}, state = 'pending', updated_at = now() WHERE id = ${payment.id} AND state = 'unknown'`);
      } catch { /* Ambiguous outcome: held for authoritative reconciliation, never auto-recreate. */ }
    }
    const current = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${payment.id}`))[0];
    res.json(view(current));
  }));
  app.post("/api/payments/redotpay/status", handle(async (req, res) => {
    await throttle(req, res, "status", 30);
    const p = await authorized(req);
    if (p.state === "paid" || p.state === "closed") return res.json(view(p));
    res.json(view(await reconcile(p)));
  }));
  app.post("/api/payments/redotpay/summary", handle(async (req, res) => {
    await throttle(req, res, "summary", 30);
    let p = await authorized(req);
    if (p.state !== "paid" && p.state !== "closed") p = await reconcile(p);
    res.json(summary(p));
  }));
  app.post("/api/payments/redotpay/cancel", handle(async (req, res) => {
    await throttle(req, res, "cancel", 6);
    let p = await authorized(req);
    p = await reconcile(p);
    if (p.state !== "paid" && p.state !== "closed") {
      const fresh = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id}`))[0];
      if (!fresh.provider_id) throw new Error("Payment identity is uncertain; administrator review required");
      await audit(p.id, "customer", "close", "requested");
      await request("/openapi/v2/order/close", { orderSn: fresh.provider_id });
      p = await reconcile(fresh);
    }
    res.json(view(p));
  }));
  app.post("/api/payments/redotpay/webhook", handle(async (req, res) => {
    const acceptance = acceptanceWebhookConfig();
    const settings = acceptance || configure();
    const raw = (req as any).rawBody;
    if (!Buffer.isBuffer(raw) || !verifyWebhook(raw, req.get("X-R-Ts") || "", req.get("X-R-Signature") || "", req.get("X-R-Key-Version") || "", settings.appKey, settings.webhookKey)) {
      return res.status(401).json({ message: "Invalid payment signature" });
    }
    // Only the authenticated bytes may determine which payment is reconciled.
    const notification = JSON.parse(raw.toString("utf8"));
    if (notification.actionType !== "ACQUIRER_PAY") return res.status(400).json({ message: "Unsupported payment notification" });
    const id = notification.outerOrderSn || notification.outerOrder;
    if (acceptance && id !== "RP_ACCEPTANCE_RAW_BODY_DOES_NOT_EXIST") return res.status(400).json({ message: "Invalid acceptance fixture" });
    const p = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${String(id)}`))[0];
    if (!p) return res.status(404).json({ message: "No payment found" });
    if (acceptance) return res.status(409).json({ message: "Acceptance fixture must not exist" });
    await reconcile(p, "provider:webhook");
    res.status(200).json({ code: "SUCCESS", requestId: randomUUID() });
  }));

  async function closePayment(p: any, actor: string) {
    p = await reconcile(p, actor);
    if (p.state === "paid" || p.state === "closed") return p;
    const fresh = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id}`))[0];
    if (!fresh.provider_id) throw new Error("Payment identity is uncertain; administrator review required");
    await audit(p.id, actor, "close", "requested");
    await request("/openapi/v2/order/close", { orderSn: fresh.provider_id });
    // A successful close response is NOT proof of closure; query again.
    return reconcile(fresh, actor);
  }
  app.get("/api/admin/redotpay", handle(async (req, res) => {
    await operator(req, res);
    const payments = rows(await getDb().execute(sql`SELECT p.*, o.status AS order_status FROM redotpay_payments p
      JOIN orders o ON o.id = p.order_id ORDER BY (p.state NOT IN ('paid','closed')) DESC, p.updated_at DESC LIMIT 100`));
    const events = rows(await getDb().execute(sql`SELECT payment_id, actor, action, outcome, created_at FROM redotpay_audit ORDER BY id DESC LIMIT 100`));
    res.json({ payments: payments.map(p => ({ ...view(p), orderStatus: p.order_status })), events });
  }));
  app.post("/api/admin/redotpay/:id/action", handle(async (req, res) => {
    const actor = await operator(req, res);
    await limit(`operator:${actor}`, 20);
    const p = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${req.params.id}`))[0];
    if (!p) throw new Error("No payment found");
    const action = req.body.action;
    if (!["reconcile", "close", "fulfill"].includes(action)) throw new Error("Invalid operator action");
    await audit(p.id, actor, action, "requested");
    try {
      if (action === "fulfill") {
        const result = await getDb().transaction(async (tx: any) => {
          const current = rows(await tx.execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id} FOR UPDATE`))[0];
          if (current.state !== "paid") throw new Error("Payment must be provider-confirmed before fulfillment");
          const order = rows(await tx.execute(sql`SELECT status FROM orders WHERE id = ${p.order_id} AND payment_method = 'redotpay' FOR UPDATE`))[0];
          const flow = ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"];
          const from = flow.indexOf(order?.status), to = flow.indexOf(req.body.status);
          if (from < 0 || to < from || to < 0) throw new Error("Invalid fulfillment transition; cancellations and refunds require verified provider handling");
          if (to !== from) await tx.execute(sql`UPDATE orders SET status = ${req.body.status},
            status_history = COALESCE(status_history, '[]'::jsonb) || ${JSON.stringify([{ status: req.body.status, timestamp: new Date().toISOString() }])}::jsonb
            WHERE id = ${p.order_id}`);
          await audit(p.id, actor, "fulfill", req.body.status, tx);
          return current;
        });
        return res.json(view(result));
      }
      res.json(view(action === "close" ? await closePayment(p, actor) : await reconcile(p, actor)));
    } catch (error) {
      await audit(p.id, actor, action, "unresolved; reservation retained");
      throw error;
    }
  }));

  // Durable, bounded serverless worker. Invoke POST with a real admin session
  // and Origin, or schedule GET using an existing CRON_SECRET bearer. No secret
  // means cron access is disabled. Never use setInterval in a Vercel function.
  async function recover(actor: string) {
    const batch = await getDb().transaction(async (tx: any) => {
      const due = rows(await tx.execute(sql`SELECT * FROM redotpay_payments
        WHERE state NOT IN ('paid','closed') AND recovery_after <= now()
        AND updated_at < now() - interval '2 minutes'
        ORDER BY recovery_after LIMIT 3 FOR UPDATE SKIP LOCKED`));
      for (const p of due) await tx.execute(sql`UPDATE redotpay_payments SET recovery_after = now() + interval '5 minutes' WHERE id = ${p.id}`);
      return due;
    });
    const result = await Promise.all(batch.map(async (p: any) => {
      await audit(p.id, actor, "recover", "requested");
      try {
        const current = new Date(p.expires_at).getTime() <= Date.now() ? await closePayment(p, actor) : await reconcile(p, actor);
        return { id: p.id, state: current.state };
      } catch {
        await audit(p.id, actor, "recover", "unresolved; reservation retained");
        return { id: p.id, state: "unresolved" };
      }
    }));
    // Rate-limit buckets have bounded retention, audit records do not.
    await getDb().execute(sql`DELETE FROM redotpay_limits WHERE reset_at < now() - interval '1 day'`);
    return { processed: result.length, results: result };
  }
  app.post("/api/admin/redotpay/recover", handle(async (req, res) => {
    const actor = await operator(req, res);
    await limit("recovery", 1);
    res.json(await recover(actor));
  }));
  app.get("/api/payments/redotpay/recover", handle(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const authorization = req.get("authorization") || "";
    if (!secret || !timingSafeEqual(Buffer.from(hash(authorization)), Buffer.from(hash(`Bearer ${secret}`)))) {
      return res.status(401).json({ message: "Payment recovery authorization required" });
    }
    await limit("recovery", 1);
    res.json(await recover("system:cron"));
  }));

  // Existing public mutation routes must never act as a payment confirmation or
  // restore RedotPay stock a second time. Use the audited operator route above.
  app.post("/api/orders", (req, res, next) => {
    if (!["cod", "bank"].includes(req.body.paymentMethod)) {
      return res.status(400).json({ message: "Use the dedicated hosted payment checkout" });
    }
    next();
  });
  app.use("/api/orders/:id", async (req, res, next) => {
    if (req.method === "GET") return next();
    try {
      const order = rows(await getDb().execute(sql`SELECT payment_method FROM orders WHERE id = ${req.params.id}`))[0];
      if (order?.payment_method === "redotpay") {
        const keys = Object.keys(req.body || {});
        const note = req.path === "/admin-note" && keys.every(k => k === "adminNote") &&
          (req.body.adminNote === null || (typeof req.body.adminNote === "string" && req.body.adminNote.length <= 5000));
        const delivery = req.path === "/delivery-status" && keys.every(k => ["deliveryStatus", "location"].includes(k)) &&
          ["label_created", "processing", "out_for_delivery", "delivered", "failed"].includes(req.body.deliveryStatus) &&
          (req.body.location == null || (typeof req.body.location === "string" && req.body.location.length <= 500));
        if (req.method === "PATCH" && isPaymentOperator(res.locals?.admin) && (note || delivery)) {
          const payment = rows(await getDb().execute(sql`SELECT state FROM redotpay_payments WHERE order_id = ${req.params.id}`))[0];
          if (payment?.state === "paid") return next();
        }
        return res.status(403).json({ message: "RedotPay payment status is provider-verified. Only authorized fulfillment of paid orders is allowed." });
      }
      next();
    } catch { res.status(503).json({ message: "Order protection is temporarily unavailable" }); }
  });
  app.get("/api/admin/redotpay/attempts", handle(async (req, res) => {
    const actor = await operator(req, res);
    if (!actor) return;
    const before = typeof req.query.before === "string" ? req.query.before : "";
    const attempts = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments
      WHERE state NOT IN ('paid', 'closed') AND (${before} = '' OR id < ${before})
      ORDER BY id DESC LIMIT 51`));
    const page = attempts.slice(0, 50);
    res.json({ attempts: page.map(p => ({ ...view(p), providerId: p.provider_id,
      createdAt: p.created_at, updatedAt: p.updated_at, expired: new Date(p.expires_at).getTime() <= Date.now() })),
      nextCursor: attempts.length > 50 ? page[49].id : null });
  }));
  app.get("/api/admin/redotpay/attempts/:id", handle(async (req, res) => {
    if (!await operator(req, res)) return;
    const p = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${req.params.id}`))[0];
    if (!p) return res.status(404).json({ message: "No payment found" });
    const audit = rows(await getDb().execute(sql`SELECT id, actor_id, action, reason, outcome, created_at, completed_at
      FROM redotpay_operator_audit WHERE payment_id = ${p.id} ORDER BY created_at DESC LIMIT 100`));
    res.json({ payment: view(p), providerId: p.provider_id, audit });
  }));
  app.post("/api/admin/redotpay/attempts/:id/reconcile", handle(async (req, res) => {
    const actor = await operator(req, res);
    await limit(`operator:${actor}`, 20);
    const action = req.body?.action;
    if (!["detail", "close"].includes(action)) throw new Error("Invalid operator action");
    const reason = text(req.body?.reason, 500);
    const p = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${req.params.id}`))[0];
    if (!p) return res.status(404).json({ message: "No payment found" });
    const auditId = randomUUID();
    // Commit intent before external I/O. An interrupted operation stays visibly
    // 'started'; absence of a completion never authorizes a stock release.
    await getDb().execute(sql`INSERT INTO redotpay_operator_audit
      (id, actor_id, payment_id, action, reason, outcome)
      VALUES (${auditId}, ${actor}, ${p.id}, ${action}, ${reason}, 'started')`);
    try {
      let current = await reconcile(p, actor);
      if (action === "close" && current.state !== "paid" && current.state !== "closed") {
        if (!current.provider_id) throw new Error("Payment provider identity unavailable; administrator review required");
        // Closing is not a local cancellation. Only the subsequent authoritative
        // detail can release stock, under the same row lock used by webhooks.
        await request("/openapi/v2/order/close", { orderSn: current.provider_id });
        current = await reconcile(current, actor);
      }
      await getDb().execute(sql`UPDATE redotpay_operator_audit SET outcome = ${current.state}, completed_at = now() WHERE id = ${auditId}`);
      res.json({ payment: view(current), auditId });
    } catch (error) {
      await getDb().execute(sql`UPDATE redotpay_operator_audit SET outcome = 'uncertain', completed_at = now() WHERE id = ${auditId}`);
      throw error;
    }
  }));

}

export async function consumePaymentRateLimit(db: any, key: string) {
  const result = rows(await db.execute(sql`
    INSERT INTO redotpay_rate_limits (bucket_key, window_start, hits)
    VALUES (${hash(key)}, date_trunc('minute', now()), 1)
    ON CONFLICT (bucket_key, window_start) DO UPDATE
      SET hits = redotpay_rate_limits.hits + 1 WHERE redotpay_rate_limits.hits < 30
    RETURNING hits`));
  if (!result.length) throw Object.assign(new Error("Payment request limit reached; try again later"), { status: 429 });
}

export type RedotPayOperator = { id: string };

export function isPaymentOperator(admin: any): boolean {
  return typeof admin?.id === "string" && !!admin.id &&
    (admin.isSuperAdmin === true || admin.permissions?.canManageOrders === true);
}

export function reservationNetwork(ip: string) {
  if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (isIP(ip) === 4) return hash(ip);
  if (isIP(ip) !== 6) throw new Error("Payment client identity unavailable");
  const [left, right] = ip.split("::");
  const a = left ? left.split(":") : [], b = right ? right.split(":") : [];
  const expanded = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  return hash(expanded.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(":"));
}

export type RedotPayDependencies = {
  configure?: typeof config;
  request?: typeof providerRequest;
  // Must validate a server-side session and operator permission, not a supplied profile.
  // Missing callback denies all operator access. Called before any DB/provider operation.
  authenticateOperator?: (req: Request) => Promise<RedotPayOperator | null>;
};
