import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/products";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CreditCard, Truck, Zap, Wallet, Upload, CheckCircle } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/lib/auth";

export default function Checkout() {
  const { items, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [deliveryType, setDeliveryType] = useState("standard");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSlipPath, setPaymentSlipPath] = useState("");
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setPaymentSlipPath(response.objectPath);
    },
  });
  
  const [formData, setFormData] = useState({
    customerName: "",
    shippingAddress: "",
    city: "",
    customerPhone: "",
    customerEmail: ""
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        customerName: prev.customerName || user.name || "",
        customerEmail: user.email || "",
        customerPhone: prev.customerPhone || user.phone || ""
      }));
    }
  }, [isAuthenticated, user]);

  const subtotal = items.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);
  const hasOutOfStockItems = items.some(item => (item.stock || 0) <= 0);

  const discount = appliedCoupon 
    ? (appliedCoupon.type === "percentage" ? (subtotal * appliedCoupon.discount) / 100 : appliedCoupon.discount) 
    : 0;
  
  const expressEligibleCities = ["male", "male'", "hulhumale", "hulhumale'", "hulhulmale"];
  const isExpressEligible = expressEligibleCities.some(city => 
    formData.city.toLowerCase().trim().includes(city)
  );
  
  const expressCharge = deliveryType === "express" && isExpressEligible
    ? items.reduce((sum, item) => sum + (item.expressCharge || 0) * (item.quantity || 0), 0)
    : 0;
  
  const shipping = 0;
  const total = Math.max(0, subtotal - discount + shipping + expressCharge);

  const handleApplyCoupon = async () => {
    try {
      const result = await api.validateCoupon(couponCode);
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponError("");
      } else {
        setCouponError("Invalid coupon code");
        setAppliedCoupon(null);
      }
    } catch (error) {
      setCouponError("Failed to validate coupon");
      setAppliedCoupon(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!formData.customerName || !formData.shippingAddress || !formData.customerPhone || !formData.customerEmail) {
      return;
    }

    setIsSubmitting(true);
    try {
      const customerEmail = isAuthenticated && user?.email 
        ? user.email 
        : (formData.customerEmail || `${formData.customerName.toLowerCase().replace(/\s+/g, '')}@customer.mv`);
      
      const orderData = {
        customerName: formData.customerName,
        customerEmail,
        customerPhone: formData.customerPhone,
        shippingAddress: `${formData.shippingAddress}, ${formData.city}`,
        items: items.map(item => ({
          name: item.name,
          qty: item.quantity,
          price: item.price,
          color: item.selectedColor,
          size: item.selectedSize
        })),
        subtotal,
        discount,
        shipping: expressCharge,
        total,
        paymentMethod: paymentMethod as "cod" | "bank",
        paymentSlip: paymentSlipPath || undefined,
        couponCode: appliedCoupon?.code,
        status: paymentMethod === "bank" ? "payment_verification" : "pending"
      };

      const order = await api.createOrder(orderData);
      clearCart();
      setLocation(`/track?id=${order.orderNumber}&status=${order.status}`);
    } catch (error) {
      console.error("Failed to create order:", error);
    } finally {
      setIsSubmitting(false);
    }
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
                  <Input 
                    placeholder="Full Name" 
                    className="rounded-none h-12"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    data-testid="input-name"
                  />
                </div>
                <div className="col-span-2">
                  <Input 
                    placeholder="Email *" 
                    type="email"
                    className={`rounded-none h-12 ${isAuthenticated ? 'bg-muted' : ''}`}
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                    readOnly={isAuthenticated}
                    required
                    data-testid="input-email"
                  />
                  {isAuthenticated ? (
                    <p className="text-[10px] text-muted-foreground mt-1">Email linked to your account</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1">Required for order confirmation</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input 
                    placeholder="Shipping Address" 
                    className="rounded-none h-12"
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                    data-testid="input-address"
                  />
                </div>
                <Input 
                  placeholder="City / Island / Boat Name" 
                  className="rounded-none h-12"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  data-testid="input-city"
                />
                <Input 
                  placeholder="Phone *" 
                  className="rounded-none h-12"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  required
                  data-testid="input-phone"
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-serif mb-6">Delivery Type</h2>
              <RadioGroup value={deliveryType} onValueChange={setDeliveryType} className="grid gap-4">
                <Label
                  className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${deliveryType === "standard" ? "border-primary bg-secondary/10" : "border-border"}`}
                  data-testid="delivery-standard"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="standard" />
                    <div className="flex items-center gap-2">
                      <Truck size={18} />
                      <div>
                        <span className="font-medium">Standard Delivery</span>
                        <p className="text-xs text-muted-foreground">FREE for Male', Hulhumale' & Boats. Other islands: charges apply.</p>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-600">FREE*</span>
                </Label>
                <Label
                  className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${deliveryType === "express" ? "border-primary bg-secondary/10" : "border-border"} ${!isExpressEligible ? 'opacity-50' : ''}`}
                  data-testid="delivery-express"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="express" disabled={!isExpressEligible} />
                    <div className="flex items-center gap-2">
                      <Zap size={18} />
                      <div>
                        <span className="font-medium">Express Delivery</span>
                        <p className="text-xs text-muted-foreground">
                          {isExpressEligible 
                            ? "Delivery within 1-6 hours (Orders after 10 PM delivered next morning)" 
                            : "Only available in Male' & Hulhumale'"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isExpressEligible && (
                    <span className="text-sm font-bold">
                      +{formatCurrency(items.reduce((sum, item) => sum + (item.expressCharge || 0) * (item.quantity || 0), 0))}
                    </span>
                  )}
                </Label>
              </RadioGroup>
              {!isExpressEligible && formData.city && (
                <p className="text-xs text-muted-foreground mt-2">
                  Express delivery is currently only available in Male' and Hulhumale'. Enter one of these cities to enable express delivery.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-serif mb-6">Payment Method</h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-4">
                <Label
                  className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${paymentMethod === "cod" ? "border-primary bg-secondary/10" : "border-border"}`}
                  data-testid="payment-cod"
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
                  data-testid="payment-bank"
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
                <div className="mt-4 p-4 bg-secondary/20 border border-dashed border-border text-sm space-y-4">
                  <div className="space-y-2">
                    <p className="font-bold uppercase tracking-widest text-[10px]">Bank Details</p>
                    <p>Bank: Bank of Maldives (BML)</p>
                    <p>Account Name: INFINITE HOME PVT LTD</p>
                    <p>Account Number: 7730000012345 (MVR)</p>
                    <p className="text-muted-foreground text-xs">Please include your order ID as the transfer remark.</p>
                  </div>
                  <div className="pt-4 border-t border-border space-y-2">
                    <p className="font-bold uppercase tracking-widest text-[10px]">Upload Payment Slip</p>
                    <div className="flex items-center gap-3">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file);
                          }}
                          disabled={isUploading}
                        />
                        <div className={`flex items-center justify-center gap-2 p-3 border border-dashed cursor-pointer hover:bg-secondary/30 transition-colors ${paymentSlipPath ? 'border-green-500 bg-green-50' : 'border-border'}`}>
                          {isUploading ? (
                            <span className="text-xs">Uploading...</span>
                          ) : paymentSlipPath ? (
                            <>
                              <CheckCircle size={16} className="text-green-600" />
                              <span className="text-xs text-green-700">Payment slip uploaded</span>
                            </>
                          ) : (
                            <>
                              <Upload size={16} />
                              <span className="text-xs">Click to upload payment slip</span>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                    <p className="text-muted-foreground text-xs">Upload a screenshot or PDF of your bank transfer receipt.</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside>
            <div className="bg-secondary/10 p-8 border border-border sticky top-32">
              <h2 className="text-xl font-serif mb-6">Order Summary</h2>
              
              <div className="mb-6 space-y-2">
                <Label className="text-xs uppercase tracking-widest font-bold">Promo Code</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter code" 
                    className="rounded-none h-10 bg-background" 
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    data-testid="input-coupon"
                  />
                  <Button 
                    variant="outline" 
                    className="rounded-none h-10 px-4 uppercase text-xs font-bold tracking-widest"
                    onClick={handleApplyCoupon}
                    data-testid="button-apply-coupon"
                  >
                    Apply
                  </Button>
                </div>
                {couponError && <p className="text-[10px] text-destructive">{couponError}</p>}
                {appliedCoupon && (
                  <p className="text-[10px] text-green-700 font-bold uppercase tracking-widest">
                    Code {appliedCoupon.code} applied! ({appliedCoupon.type === "percentage" ? `${appliedCoupon.discount}%` : `MVR ${appliedCoupon.discount}`} off)
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-6">
                {items.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex justify-between text-sm">
                    <div className="flex flex-col">
                      <span className={`font-medium ${item.stock && item.stock > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {item.name} x {item.quantity}
                        {item.stock !== undefined && item.stock <= 0 && " (Out of Stock)"}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {item.selectedColor}{item.selectedSize ? ` / ${item.selectedSize}` : ''}
                      </span>
                    </div>
                    <span className={item.stock && item.stock > 0 ? '' : 'text-destructive'}>
                      {formatCurrency(item.price * (item.quantity || 0))}
                    </span>
                  </div>
                ))}
              </div>
              {hasOutOfStockItems && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive text-destructive text-[10px] uppercase tracking-widest font-bold">
                  Some items in your cart are currently out of stock. Please remove them to proceed.
                </div>
              )}
              <div className="space-y-2 py-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Standard Shipping</span>
                  <span className="text-green-600">FREE</span>
                </div>
                {deliveryType === "express" && expressCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Express Delivery</span>
                    <span>+{formatCurrency(expressCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span data-testid="text-total">{formatCurrency(total)}</span>
                </div>
              </div>
              <Button 
                onClick={handlePlaceOrder}
                className="w-full h-12 rounded-none mt-6 uppercase tracking-widest font-bold"
                disabled={isSubmitting || hasOutOfStockItems || !formData.customerName || !formData.shippingAddress || !formData.customerPhone || !formData.customerEmail || (paymentMethod === "bank" && !paymentSlipPath)}
                data-testid="button-place-order"
              >
                {isSubmitting ? "Processing..." : (hasOutOfStockItems ? "Items Out of Stock" : (paymentMethod === "bank" && !paymentSlipPath ? "Upload Slip to Proceed" : "Place Order"))}
              </Button>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
