export const PAYMENT_TOKEN_KEY = "redotpay-payment-token";
export const PAYMENT_ID_KEY = "redotpay-payment-id";
const PAYMENT_TOKEN_PREFIX = "redotpay-payment-token:";

export function isPaymentId(value: unknown): value is string {
  return typeof value === "string" && /^RP[a-f0-9]{28}$/.test(value);
}

export function paymentReturnId(search = window.location.search) {
  const id = new URLSearchParams(search).get("id");
  return isPaymentId(id) ? id : null;
}

export function paymentReturnPath(id: string, summary = false) {
  if (!isPaymentId(id)) throw new Error("Invalid payment reference");
  return `${summary ? "/order-summary/redotpay" : "/payment/redotpay"}?id=${encodeURIComponent(id)}`;
}

export function bindPaymentToken(id: string, token: string) {
  if (!isPaymentId(id) || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid payment session");
  // Store the durable per-payment capability before publishing this attempt as active.
  localStorage.setItem(`${PAYMENT_TOKEN_PREFIX}${id}`, token);
  localStorage.setItem(PAYMENT_TOKEN_KEY, token);
  localStorage.setItem(PAYMENT_ID_KEY, id);
}

export function paymentTokenFor(id: string) {
  return isPaymentId(id) ? localStorage.getItem(`${PAYMENT_TOKEN_PREFIX}${id}`) : null;
}

export function retireActivePayment(id: string) {
  if (localStorage.getItem(PAYMENT_ID_KEY) !== id) return;
  localStorage.removeItem(PAYMENT_ID_KEY);
  localStorage.removeItem(PAYMENT_TOKEN_KEY);
}

export async function paymentRequest(action: string, body: unknown = {}, token?: string) {
  const response = await fetch(`/api/payments/redotpay/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Payment request failed");
  return data;
}

export async function recoverUnboundPaymentToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid pending payment session");
  try {
    const payment = await paymentRequest("status", {}, token);
    bindPaymentToken(payment.id, token);
    return payment;
  } catch (error) {
    // This exact capability lookup result alone proves create did not commit.
    if (error instanceof Error && error.message === "No payment found") return null;
    throw error;
  }
}

export function paymentToken() {
  const existingToken = localStorage.getItem(PAYMENT_TOKEN_KEY);
  const existingId = localStorage.getItem(PAYMENT_ID_KEY);
  if (existingToken && !existingId) {
    if (!/^[a-f0-9]{64}$/.test(existingToken)) throw new Error("Invalid pending payment session");
    return existingToken;
  }
  // An identified capability belongs only to that payment and must never be
  // silently reused for a fresh create attempt.
  if (existingToken || existingId) throw new Error("An existing payment must be resolved before starting another");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  // Persist before create: a lost response can be retried idempotently with
  // the same capability and recover the server-created payment.
  localStorage.setItem(PAYMENT_TOKEN_KEY, token);
  return token;
}