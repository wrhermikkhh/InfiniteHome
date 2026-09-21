// Server-only RedotPay protocol adapter. Never import this module into the client.
import { createPrivateKey, sign, verify } from "node:crypto";

export const REDOTPAY_RATE = 15.42;
// Official v2 Getting Started environment table and signature guide (key v1).
// Never accept a key or API host supplied by a checkout request.
export const SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuctrVK3eP8hpoJf7FMet
lcR77FYcj9HtrkySyGDRt5HHwdwgM8jK0kfE4ag/zI8goe8M0iJ2o7n3VCfTzn8O
yfU0bu6KzDti1WOJV9fv4XtSmhm9W4WKjIc8uDQViR7E8trzcrbKFVbKVGng1+z0
KobQBDtWhjUeXKktUq1lpiejTS+XjXej26ANPfwbqbY+/6kBB3sWbt9BLDI/WhPY
XnFV9oJWod9I/dYUgUUA/b/+bI1wlobNntBDxiNmX0kbqpGZbzO6l9wWFXZiFCD2
5QtBOZlMbn9noH4KW3DnKGc2nKNz/f2FEM9DJKn3P7NGFVy6O/Q5NzcbFs+DI6nT
ywIDAQAB
-----END PUBLIC KEY-----`;
export const PRODUCTION_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzMn4r06M/cp2amkbCxIs
PSr030JoCFeymwjTZrBnI8kW4mtL6JtUPYpJTFgCB8ZQoV75lEmUw8gSLbN770Cc
5EOi1dF4ekmLQ7Ez0SFUbQgJa7Vg5wBdSKcbUmkKGviJt+iZRJ0tZsPpXMPqIo9Y
OWJagfPbDhEwT2t1ANP4ou98sCqLqELI80iYm8+W4B9IvBW4lc+H5BAPtXpYMtlZ
6stCnvHXd1EjvlTak25v5xJ8AInEeAy8/D2glunmz/VfPyoB5OHPgnYVU66HyeQc
O1ZY/jzB5d6I/zX4JENG1xrP8ThPZ9qMWtmputJ0XYKymiZgZP6vh0L+G6P/Z98v
lQIDAQAB
-----END PUBLIC KEY-----`;

export function usdCents(mvrCents: number): number {
  if (!Number.isSafeInteger(mvrCents) || mvrCents <= 0) throw new Error("Invalid MVR total");
  const cents = Math.round(mvrCents / REDOTPAY_RATE);
  if (cents < 1) throw new Error("Order is below the minimum USD payment amount");
  return cents;
}

export function publicOrigin(value: string | undefined): string {
  if (!value) throw new Error("REDOTPAY_PUBLIC_ORIGIN is not configured");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("REDOTPAY_PUBLIC_ORIGIN must be a valid HTTPS public origin"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash || !url.hostname.includes(".") ||
      /localhost|\.local$|^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    throw new Error("REDOTPAY_PUBLIC_ORIGIN must be an HTTPS public origin without a path");
  }
  return url.origin;
}

export function config(env: NodeJS.ProcessEnv = process.env) {
  if (env.REDOTPAY_ENABLED !== "true") throw new Error("RedotPay is disabled pending deployment and security review");
  const origin = publicOrigin(env.REDOTPAY_PUBLIC_ORIGIN);
  if (!["production", "sandbox"].includes(env.REDOTPAY_ENVIRONMENT || "")) throw new Error("RedotPay environment must be production or sandbox");
  if (Number(env.REDOTPAY_MVR_PER_USD) !== REDOTPAY_RATE) throw new Error(`RedotPay exchange rate must be ${REDOTPAY_RATE} MVR per USD`);
  if (!env.REDOTPAY_APP_KEY || !env.REDOTPAY_PRIVATE_KEY || !/^[1-9]\d*$/.test(env.REDOTPAY_KEY_VERSION || "")) {
    throw new Error("RedotPay merchant credentials or key version are missing");
  }
  try {
    const key = createPrivateKey(env.REDOTPAY_PRIVATE_KEY.replace(/\\n/g, "\n"));
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw new Error();
    return { origin, key, appKey: env.REDOTPAY_APP_KEY, version: env.REDOTPAY_KEY_VERSION!,
      apiOrigin: env.REDOTPAY_ENVIRONMENT === "sandbox" ? "https://acquirersandbox.rp-2023app.com" : "https://acquirer.redotpay.com",
      publicKey: env.REDOTPAY_ENVIRONMENT === "sandbox" ? SANDBOX_PUBLIC_KEY : PRODUCTION_PUBLIC_KEY };
  } catch {
    throw new Error("RedotPay signing key is invalid; RSA 2048-bit or stronger is required");
  }
}

export function verifyWebhook(raw: Buffer, timestamp: string, signature: string, version: string, appKey: string, key = PRODUCTION_PUBLIC_KEY): boolean {
  // Retries may carry an old timestamp. Authenticity + authoritative query + DB
  // idempotency, rather than a short replay window, protects delayed delivery.
  if (version !== "1" || !/^\d{13}$/.test(timestamp) || Number(timestamp) > Date.now() + 300000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false;
  try {
    return verify("RSA-SHA256", Buffer.concat([Buffer.from(`${appKey}.${timestamp}.`), raw]), key, Buffer.from(signature, "base64"));
  } catch { return false; }
}

export async function providerRequest(path: "/openapi/v2/order/create" | "/openapi/v2/order/detail" | "/openapi/v2/order/close", payload: unknown, fetcher: typeof fetch = fetch, settings: { origin: string; key: ReturnType<typeof createPrivateKey>; appKey: string; version: string; apiOrigin?: string } = config()) {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = sign("RSA-SHA256", Buffer.from(`POST ${path}\n${settings.appKey}.${timestamp}.${body}`), settings.key).toString("base64");
  const apiOrigin = settings.apiOrigin || "https://acquirer.redotpay.com";
  if (!["https://acquirer.redotpay.com", "https://acquirersandbox.rp-2023app.com"].includes(apiOrigin)) throw new Error("Invalid RedotPay API origin");
  const response = await fetcher(`${apiOrigin}${path}`, {
    // Recovery may perform detail → close → detail within a bounded invocation.
    method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", "X-R-AK": settings.appKey,
      "X-R-Ts": timestamp, "X-R-Key-Version": settings.version, "X-R-Signature": signature },
    body,
  });
  if (!response.ok) throw new Error("RedotPay is temporarily unavailable; check payment status before retrying");
  const result = await response.json();
  if (result.code !== "SUCCESS" || result.data == null) throw new Error("RedotPay did not confirm the request; check payment status before retrying");
  return result.data;
}

export function matchesPayment(detail: any, expected: { id: string; usd_cents: number; provider_id?: string | null }) {
  return detail && detail.outerOrderSn === expected.id && detail.orderCurrency === "USD" &&
    Number.isFinite(Number(detail.orderAmount)) &&
    Math.abs(Number(detail.orderAmount) * 100 - expected.usd_cents) < 0.000001 &&
    typeof detail.orderSn === "string" && detail.orderSn.length > 0 &&
    (!expected.provider_id || detail.orderSn === expected.provider_id);
}