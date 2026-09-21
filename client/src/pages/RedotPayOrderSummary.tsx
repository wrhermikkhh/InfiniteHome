import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Package, Truck } from "lucide-react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { PAYMENT_TOKEN_KEY, paymentRequest } from "@/lib/redotpay";

type SummaryItem = {
  productId: string;
  name: string;
  qty: number;
  size?: string;
  color?: string;
  isPreOrder?: boolean;
  preOrderEta?: string;
};

type OrderSummary = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  status: string;
  paidAmount: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  deliveryType: string;
  shippingSpeed?: string;
  boatName?: string;
  boatNumber?: string;
  boatLocation?: string;
  boatAtollIsland?: string;
  notes?: string;
  items: SummaryItem[];
  confirmedAt?: string;
};

const label = (value?: string) => value
  ? value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())
  : "—";

export default function RedotPayOrderSummary() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(PAYMENT_TOKEN_KEY);
    if (!token) {
      setError("This order summary is available only on the browser used to complete payment.");
      return;
    }
    paymentRequest("summary", {}, token)
      .then(setSummary)
      .catch(error => setError(error instanceof Error ? error.message : "Unable to load the order summary"));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 pb-24 pt-32">
        {!summary && !error && <p className="text-center text-muted-foreground">Loading your confirmed order…</p>}
        {error && (
          <div role="alert" className="mx-auto max-w-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <h1 className="mb-2 font-serif text-2xl">Order summary unavailable</h1>
            <p>{error}</p>
          </div>
        )}
        {summary && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header className="border border-green-200 bg-green-50 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="mt-1 shrink-0 text-green-700" size={34} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-800">Payment confirmed</p>
                  <h1 className="mt-1 font-serif text-3xl md:text-4xl">Thank you for your order</h1>
                  <p className="mt-2 text-muted-foreground">Your order is confirmed and will now be prepared.</p>
                </div>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order number</p>
                <p className="mt-2 break-all font-semibold">{summary.orderNumber}</p>
              </div>
              <div className="border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tracking number</p>
                <p className="mt-2 break-all font-mono font-semibold">{summary.trackingNumber}</p>
              </div>
              <div className="border bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Paid with RedotPay</p>
                <p className="mt-2 text-xl font-semibold">USD {summary.paidAmount}</p>
              </div>
            </section>

            <section className="border bg-white p-6 md:p-8">
              <h2 className="mb-6 flex items-center gap-3 font-serif text-2xl"><Package size={22} /> Order items</h2>
              <div className="divide-y">
                {summary.items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="flex justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[item.size, item.color, item.isPreOrder ? "Pre-order" : ""].filter(Boolean).join(" · ")}
                      </p>
                      {item.preOrderEta && <p className="mt-1 text-xs text-muted-foreground">Estimated availability: {item.preOrderEta}</p>}
                    </div>
                    <p className="shrink-0 font-medium">Qty {item.qty}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="border bg-white p-6">
                <h2 className="mb-4 flex items-center gap-3 font-serif text-xl"><MapPin size={20} /> Shipping address</h2>
                <p className="font-semibold">{summary.customerName}</p>
                <p className="mt-2 whitespace-pre-wrap">{summary.shippingAddress}</p>
                <p className="mt-3 text-sm text-muted-foreground">{summary.customerPhone}</p>
                <p className="text-sm text-muted-foreground">{summary.customerEmail}</p>
              </section>
              <section className="border bg-white p-6">
                <h2 className="mb-4 flex items-center gap-3 font-serif text-xl"><Truck size={20} /> Delivery details</h2>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-muted-foreground">Delivery area</dt><dd className="font-medium">{label(summary.deliveryType)}</dd></div>
                  {summary.shippingSpeed && <div><dt className="text-muted-foreground">Shipping speed</dt><dd className="font-medium">{label(summary.shippingSpeed)}</dd></div>}
                  {summary.boatName && <div><dt className="text-muted-foreground">Boat</dt><dd className="font-medium">{summary.boatName}{summary.boatNumber ? ` · ${summary.boatNumber}` : ""}</dd></div>}
                  {summary.boatLocation && <div><dt className="text-muted-foreground">Boat location</dt><dd className="font-medium">{summary.boatLocation}</dd></div>}
                  {summary.boatAtollIsland && <div><dt className="text-muted-foreground">Atoll / island</dt><dd className="font-medium">{summary.boatAtollIsland}</dd></div>}
                </dl>
              </section>
            </div>

            {summary.notes && (
              <section className="border bg-white p-6">
                <h2 className="mb-2 font-serif text-xl">Order notes</h2>
                <p className="whitespace-pre-wrap text-sm">{summary.notes}</p>
              </section>
            )}

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-none"><Link href={`/track?id=${encodeURIComponent(summary.trackingNumber)}`}>Track this order</Link></Button>
              <Button variant="outline" className="rounded-none" onClick={() => {
                localStorage.removeItem(PAYMENT_TOKEN_KEY);
                window.location.assign("/shop");
              }}>Continue shopping</Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}