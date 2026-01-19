import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/lib/cart";
import { formatCurrency, products } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation } from "wouter";
import { CreditCard, Truck, ShieldCheck, Wallet } from "lucide-react";

export default function Checkout() {
  const { items, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("cod");

  const subtotal = items.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);
  const shipping = subtotal > 1500 ? 0 : 150;
  const total = subtotal + shipping;

  const handlePlaceOrder = () => {
    // In a real app, this would create an order record
    const orderId = `IH-${Math.floor(10000 + Math.random() * 90000)}`;
    clearCart();
    setLocation(`/track?id=${orderId}&status=${paymentMethod === "bank" ? "payment_verification" : "ordered"}`);
  };

  if (items.length === 0) {
    setLocation("/shop");
    return null;
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      <div className="pt-32 pb-24 container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16">
          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-serif mb-6">Delivery Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input placeholder="Full Name" className="rounded-none h-12" />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Shipping Address" className="rounded-none h-12" />
                </div>
                <Input placeholder="City" className="rounded-none h-12" />
                <Input placeholder="Phone" className="rounded-none h-12" />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-serif mb-6">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-4">
                <Label
                  className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${paymentMethod === "cod" ? "border-primary bg-secondary/10" : "border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="cod" />
                    <div className="flex items-center gap-2">
                      <Wallet size={18} />
                      <span>Cash on Delivery</span>
                    </div>
                  </div>
                </Label>
                <Label
                  className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${paymentMethod === "bank" ? "border-primary bg-secondary/10" : "border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="bank" />
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} />
                      <span>Bank Transfer</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground italic">Verification required</span>
                </Label>
              </RadioGroup>
              
              {paymentMethod === "bank" && (
                <div className="mt-4 p-4 bg-secondary/20 border border-dashed border-border text-sm space-y-2">
                  <p className="font-bold uppercase tracking-widest text-[10px]">Bank Details</p>
                  <p>Bank: Bank of Maldives (BML)</p>
                  <p>Account Name: INFINITE HOME PVT LTD</p>
                  <p>Account Number: 7730000012345 (MVR)</p>
                  <p className="text-muted-foreground text-xs">Please include your order ID as the transfer remark.</p>
                </div>
              )}
            </section>
          </div>

          <aside>
            <div className="bg-secondary/10 p-8 border border-border sticky top-32">
              <h2 className="text-xl font-serif mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.name} x {item.quantity}</span>
                    <span>{formatCurrency(item.price * (item.quantity || 0))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 py-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? "FREE" : formatCurrency(shipping)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
              <Button 
                onClick={handlePlaceOrder}
                className="w-full h-12 rounded-none mt-6 uppercase tracking-widest font-bold"
              >
                Place Order
              </Button>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
