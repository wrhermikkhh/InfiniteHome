export const PAYMENT_TOKEN_KEY = "redotpay-payment-token";
export async function paymentRequest(action: string, body: unknown = {}, token?: string) {
  const response = await fetch(`/api/payments/redotpay/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Payment request failed");
  return data;
}
export function paymentToken() {
  let token = localStorage.getItem(PAYMENT_TOKEN_KEY);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(PAYMENT_TOKEN_KEY, token);
  }
  return token;
}