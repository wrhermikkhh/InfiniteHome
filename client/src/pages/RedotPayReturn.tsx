import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { paymentRequest, PAYMENT_TOKEN_KEY } from "@/lib/redotpay";
import { useCart } from "@/lib/cart";

export default function RedotPayReturn() {
  const [payment, setPayment] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { clearCart } = useCart();
  async function check(action = "status") {
    const token = localStorage.getItem(PAYMENT_TOKEN_KEY);
    if (!token) { setError("Payment session not found on this browser. Contact the store with your order reference; do not pay again."); return null; }
    setBusy(true);
    setError("");
    try {
      const result = await paymentRequest(action, {}, token);
      setPayment(result);
      if (result.state === "paid") {
        clearCart();
        localStorage.removeItem(PAYMENT_TOKEN_KEY);
        const orderReference = result.trackingNumber || result.id;
        window.location.replace(`/track?id=${encodeURIComponent(orderReference)}&status=confirmed`);
      }
      return result;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      const result = await check();
      attempts += 1;
      if (!cancelled && attempts < 40 && result && !["paid", "closed"].includes(result.state)) {
        timer = setTimeout(() => void poll(), 3000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return <><Navbar /><main className="max-w-2xl mx-auto px-6 py-20 space-y-6">
    <h1 className="text-3xl font-serif">RedotPay payment</h1>
    <p>We are automatically verifying your payment with RedotPay. Once confirmed, you will be taken to your order tracking page.</p>
    {payment && <section className="border p-6 space-y-4">
      <h2 className="font-semibold text-xl">{payment.state === "paid" ? "Payment confirmed" : payment.state === "closed" ? "Payment cancelled — stock released" : payment.state === "failed" ? "Payment failed — stock still reserved" : "Payment pending — not yet confirmed"}</h2>
      <p>Order: {payment.trackingNumber || payment.id}</p>
      <p className="text-sm">Payment reference: {payment.id}</p>
      <p>Final server-verified charge: <strong>USD {payment.usdAmount}</strong>.</p>
      <p className="text-sm text-muted-foreground">{payment.reservationPolicy}</p>
      {payment.checkoutUrl && new Date(payment.expiresAt).getTime() > Date.now() &&
        <Button onClick={() => window.location.assign(payment.checkoutUrl)}>Continue existing payment</Button>}
      {payment.state !== "paid" && payment.state !== "closed" &&
        <Button variant="outline" disabled={busy} onClick={() => void check("cancel")}>Request verified cancellation</Button>}
      <p><Link href={`/track?id=${payment.trackingNumber || payment.id}`}>View order tracking</Link></p>
      {(payment.state === "closed" || payment.state === "paid") && <Button variant="outline" onClick={() => {
        localStorage.removeItem(PAYMENT_TOKEN_KEY); window.location.assign(payment.state === "paid" ? "/shop" : "/checkout");
      }}>{payment.state === "paid" ? "Back to shop" : "Retry with a new checkout"}</Button>}
    </section>}
    {error && <p role="alert" className="text-red-700">{error} If the result is uncertain, stock remains reserved. Contact the store; do not start another payment.</p>}
    <Button disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Refresh verified status"}</Button>
  </main><Footer /></>;
}