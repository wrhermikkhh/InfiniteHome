// Shared by Express development and Vercel. No dependency on either DB driver.
import type { Express, Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { config, matchesPayment, providerRequest, usdCents, verifyWebhook, REDOTPAY_RATE } from "./redotpay";

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
  return { items, subtotal: subtotal / 100, discount: discount / 100, shipping: shipping / 100, total: totalCents / 100, usdCents: cents, rate: REDOTPAY_RATE };
}

export function registerRedotPay(app: Express, getDb: () => any, ordersTable: any,
  dependencies: { configure?: typeof config; request?: typeof providerRequest } = {}) {
  const configure = dependencies.configure || config;
  const request = dependencies.request || providerRequest;
  async function readiness() {
    try {
      configure();
      const result = rows(await getDb().execute(sql`SELECT version FROM redotpay_schema WHERE version = 1`));
      if (!result.length) throw new Error();
      await getDb().execute(sql`SELECT id, token_hash, usd_cents, state, allocations, order_id, payload, provider_id, checkout_url, expires_at FROM redotpay_payments LIMIT 0`);
      return { available: true, rate: REDOTPAY_RATE, currency: "USD", message: "" };
    } catch (error: any) {
      const message = /RedotPay|REDOTPAY/.test(error.message) ? error.message : "RedotPay payment migration is missing or unavailable";
      return { available: false, rate: REDOTPAY_RATE, currency: "USD", message };
    }
  }
  const handle = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try { await fn(req, res); } catch (error: any) {
      // Never return provider payloads, DB errors, signatures or keys.
      const safe = /^(Invalid|Missing|Product|Pre-order|Maximum|Coupon|Order |Stock |RedotPay|Payment |Checkout |No payment)/.test(error.message || "");
      res.status(400).json({ message: safe ? error.message : "Payment request could not be completed. Check status before retrying." });
    }
  };
  async function ready() {
    const status = await readiness();
    if (!status.available) throw new Error(status.message);
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
    return { id: p.id, state: p.state, orderId: p.order_id, total: p.payload.total,
      usdAmount: (p.usd_cents / 100).toFixed(2), rate: REDOTPAY_RATE, expiresAt: p.expires_at,
      checkoutUrl: p.state === "pending" ? p.checkout_url : null,
      reservationPolicy: "Stock is held until RedotPay confirms payment or closure. Closing this page does not cancel payment. Use Cancel and release; uncertain payments stay reserved for reconciliation." };
  }
  async function release(tx: any, p: any) {
    for (const a of p.allocations) {
      const product = rows(await tx.execute(sql`SELECT * FROM products WHERE id = ${a.productId} FOR UPDATE`))[0];
      if (!product) throw new Error("Stock reconciliation requires administrator review");
      if (a.preOrder) {
        const map = product.pre_order_variant_stock || {};
        if (a.key) map[a.key] = (map[a.key] || 0) + a.qty;
        await tx.execute(sql`UPDATE products SET pre_order_stock = ${a.total ? (product.pre_order_stock ?? 0) + a.qty : product.pre_order_stock},
          pre_order_variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${a.productId}`);
      } else if (a.key) {
        const map = product.variant_stock || {};
        map[a.key] = (map[a.key] || 0) + a.qty;
        await tx.execute(sql`UPDATE products SET variant_stock = ${JSON.stringify(map)}::jsonb WHERE id = ${a.productId}`);
      } else await tx.execute(sql`UPDATE products SET stock = stock + ${a.qty} WHERE id = ${a.productId}`);
    }
  }
  async function reconcile(p: any) {
    const detail = await request("/openapi/v2/order/detail", { outerOrderSn: p.id });
    if (!matchesPayment(detail, p)) throw new Error("Payment details do not match; administrator review required");
    return getDb().transaction(async (tx: any) => {
      const current = rows(await tx.execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id} FOR UPDATE`))[0];
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
      return current;
    });
  }

  app.get("/api/payments/redotpay/readiness", handle(async (_req, res) => { res.json(await readiness()); }));
  app.post("/api/payments/redotpay/quote", handle(async (req, res) => {
    await ready();
    res.json((await quote(getDb(), req.body)).quote);
  }));
  app.post("/api/payments/redotpay/create", handle(async (req, res) => {
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
      const { quote: q, products } = await quote(tx, input, true);
      if (input.expectedUsdCents !== q.usdCents || input.expectedTotal !== q.total) throw new Error("Checkout total changed. Request a new quote before paying.");
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
      const payload = { customerName: text(input.customerName), customerEmail: text(input.customerEmail),
        customerPhone: text(input.customerPhone, 50), shippingAddress: text(input.shippingAddress, 1000),
        deliveryType: input.deliveryType, notes: typeof input.notes === "string" ? input.notes.slice(0, 1000) : null,
        ...(input.deliveryType === "boat" ? { boatName: text(input.boatName), boatNumber: text(input.boatNumber), boatLocation: text(input.boatLocation), boatAtollIsland: text(input.boatAtollIsland) } : {}),
        items: q.items, subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total,
        couponCode: input.couponCode || null, paymentMethod: "redotpay", status: "payment_pending",
        orderNumber: id, trackingNumber: id, statusHistory: [{ status: "payment_pending", timestamp: new Date().toISOString() }] };
      const [order] = await tx.insert(ordersTable).values(payload).returning();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      return rows(await tx.execute(sql`INSERT INTO redotpay_payments (id, token_hash, usd_cents, state, order_id, payload, allocations, expires_at)
        VALUES (${id}, ${tokenHash}, ${q.usdCents}, 'creating', ${order.id}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(allocations)}::jsonb, ${expiresAt})
        RETURNING *`))[0];
    });
    // Claim once. A crash/timeout is ambiguous: never issue another create.
    const claimed = rows(await getDb().execute(sql`UPDATE redotpay_payments SET state = 'unknown', updated_at = now() WHERE id = ${payment.id} AND state = 'creating' RETURNING *`));
    if (claimed.length) {
      try {
        const settings = configure();
        const result = await request("/openapi/v2/order/create", {
          outerOrderSn: payment.id, outerUid: payment.id, orderAmount: payment.usd_cents / 100,
          orderCurrency: "USD", env: "WEB", orderDesc: `Store order ${payment.id}`,
          timeExpire: new Date(payment.expires_at).getTime(), redirectUrl: `${settings.origin}/payment/redotpay`,
          goods: [{ goodsType: "01", goodsCategory: "Z000", goodsCode: payment.id.slice(0, 19),
            goodsName: "Store order", goodsCount: 1, goodsAmount: payment.usd_cents / 100, goodsCoin: "USD" }],
        });
        const url = new URL(result.webUrl);
        if (url.protocol !== "https:" || url.username || url.password || result.outerOrderSn !== payment.id || !result.orderSn) throw new Error("Invalid provider checkout response");
        await getDb().execute(sql`UPDATE redotpay_payments SET provider_id = ${result.orderSn}, checkout_url = ${url.href}, state = 'pending', updated_at = now() WHERE id = ${payment.id} AND state = 'unknown'`);
      } catch { /* Ambiguous outcome: held for authoritative reconciliation, never auto-recreate. */ }
    }
    const current = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${payment.id}`))[0];
    res.json(view(current));
  }));
  app.post("/api/payments/redotpay/status", handle(async (req, res) => {
    await ready();
    const p = await authorized(req);
    if (p.state === "paid" || p.state === "closed") return res.json(view(p));
    res.json(view(await reconcile(p)));
  }));
  app.post("/api/payments/redotpay/cancel", handle(async (req, res) => {
    await ready();
    let p = await authorized(req);
    p = await reconcile(p);
    if (p.state !== "paid" && p.state !== "closed") {
      const fresh = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${p.id}`))[0];
      await request("/openapi/v2/order/close", { orderSn: fresh.provider_id });
      p = await reconcile(fresh);
    }
    res.json(view(p));
  }));
  app.post("/api/payments/redotpay/webhook", handle(async (req, res) => {
    const settings = configure();
    const raw = (req as any).rawBody;
    if (!Buffer.isBuffer(raw) || !verifyWebhook(raw, req.get("X-R-Ts") || "", req.get("X-R-Signature") || "", req.get("X-R-Key-Version") || "", settings.appKey)) {
      return res.status(401).json({ message: "Invalid payment signature" });
    }
    if (req.body.actionType !== "ACQUIRER_PAY") return res.status(400).json({ message: "Unsupported payment notification" });
    const id = req.body.outerOrderSn || req.body.outerOrder;
    const p = rows(await getDb().execute(sql`SELECT * FROM redotpay_payments WHERE id = ${String(id)}`))[0];
    if (!p) return res.status(404).json({ message: "No payment found" });
    await reconcile(p);
    res.status(200).json({ code: "SUCCESS", requestId: randomUUID() });
  }));

  // Existing public mutation routes must never act as a payment confirmation or
  // restore RedotPay stock a second time. Fulfillment requires a future audited
  // authenticated admin workflow; deliberately fail closed here.
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
      if (order?.payment_method === "redotpay") return res.status(403).json({ message: "RedotPay orders cannot be changed through public order routes. Payment status is verified with the provider." });
      next();
    } catch { res.status(503).json({ message: "Order protection is temporarily unavailable" }); }
  });
}