import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/lib/cart";
import { formatCurrency, getVariantStock, type Product } from "@/lib/products";
import { api, CustomerAddress } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { CreditCard, Truck, Zap, Wallet, Upload, CheckCircle, MapPin, Plus } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export default function Checkout() {
  const { items, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [deliveryLocation, setDeliveryLocation] = useState<"male" | "hulhumale" | "boat">("male");
  const [deliveryType, setDeliveryType] = useState<"standard" | "express">("standard");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [eligibleDiscount, setEligibleDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSlipPath, setPaymentSlipPath] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const { uploadFile, isUploading } = useUpload({
    endpoint: "/api/uploads/payment-slips",
    onSuccess: (response) => {
      // Store just the path within the bucket (e.g., "uploads/xxx")
      setPaymentSlipPath(response.objectPath);
    },
  });
  
  const [formData, setFormData] = useState({
    customerName: "",
    shippingAddress: "",
    city: "",
    customerPhone: "",
    customerEmail: "",
    boatName: "",
    boatNumber: "",
    boatLocation: "",
    notes: ""
  });

  useEffect(() => {
    let cancelled = false;
    
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        customerName: prev.customerName || user.name || "",
        customerEmail: user.email || "",
        customerPhone: prev.customerPhone || user.phone || ""
      }));
      
      setLoadingAddresses(true);
      api.getCustomerAddresses(user.id).then((addresses) => {
        if (cancelled) return;
        setSavedAddresses(addresses);
        if (addresses.length > 0) {
          const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
          setSelectedAddressId(defaultAddr.id);
          const streetParts = [defaultAddr.streetAddress, defaultAddr.addressLine2].filter(Boolean);
          const streetAddress = streetParts.join(", ") || defaultAddr.fullAddress.split(", ").slice(0, -1).join(", ");
          const city = defaultAddr.cityIsland || defaultAddr.fullAddress.split(", ").pop() || "";
          setFormData(prev => ({
            ...prev,
            customerName: defaultAddr.fullName || prev.customerName,
            shippingAddress: streetAddress,
            city: city,
            customerPhone: defaultAddr.mobileNo || prev.customerPhone
          }));
        } else {
          setShowNewAddressForm(true);
        }
      }).catch(console.error).finally(() => {
        if (!cancelled) setLoadingAddresses(false);
      });
    } else {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      setShowNewAddressForm(false);
    }
    
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  const applyAddress = (addr: CustomerAddress) => {
    const streetParts = [addr.streetAddress, addr.addressLine2].filter(Boolean);
    const streetAddress = streetParts.join(", ") || addr.fullAddress.split(", ").slice(0, -1).join(", ");
    const city = addr.cityIsland || addr.fullAddress.split(", ").pop() || "";
    setFormData(prev => ({
      ...prev,
      customerName: addr.fullName || prev.customerName,
      shippingAddress: streetAddress,
      city: city,
      customerPhone: addr.mobileNo || prev.customerPhone
    }));
  };

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowNewAddressForm(false);
    const addr = savedAddresses.find(a => a.id === addressId);
    if (addr) applyAddress(addr);
  };

  const { data: freshProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchInterval: 30000,
  });

  const getItemLiveStock = (item: typeof items[0]) => {
    if ((item as any).isPreOrder) return Infinity;
    const freshProduct = freshProducts.find((p) => p.id === item.id);
    if (freshProduct) {
      return getVariantStock(freshProduct, item.selectedSize, item.selectedColor);
    }
    return getVariantStock(item, item.selectedSize, item.selectedColor);
  };

  const inStockItems = items.filter((item) => getItemLiveStock(item) > 0);
  const subtotal = inStockItems.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);
  const hasOutOfStockItems = items.some(item => {
    const stock = getItemLiveStock(item);
    return stock <= 0 || (item.quantity || 0) > stock;
  });

  const discount = eligibleDiscount;
  
  // Express delivery only available for Male/Hulhumale, not for boat deliveries
  const isExpressAvailable = deliveryLocation !== "boat";
  const expressCharge = deliveryType === "express" && isExpressAvailable
    ? inStockItems.reduce((sum, item) => sum + (item.expressCharge || 0) * (item.quantity || 0), 0)
    : 0;
  
  const shipping = expressCharge;
  const total = Math.max(0, subtotal - discount + shipping);

  const handleApplyCoupon = async () => {
    try {
      const cartItems = items.map(item => ({
        productId: item.id,
        category: item.category,
        price: item.price,
        qty: item.quantity || 1,
        isPreOrder: (item as any).isPreOrder || false
      }));
      
      const result = await api.validateCouponWithItems(couponCode, cartItems);
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setEligibleDiscount(result.discountAmount || 0);
        setCouponError("");
        setCouponMessage(result.message || "");
      } else {
        setCouponError(result.message || "Invalid coupon code");
        setAppliedCoupon(null);
        setEligibleDiscount(0);
        setCouponMessage("");
      }
    } catch (error) {
      setCouponError("Failed to validate coupon");
      setAppliedCoupon(null);
      setEligibleDiscount(0);
      setCouponMessage("");
    }
  };

  const handlePlaceOrder = async () => {
    // Validate required fields
    if (!formData.customerName || !formData.shippingAddress || !formData.customerPhone || !formData.customerEmail) {
      return;
    }

    // Additional validation for boat deliveries
    if (deliveryLocation === "boat" && (!formData.boatName || !formData.boatNumber || !formData.boatLocation)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const customerEmail = isAuthenticated && user?.email 
        ? user.email 
        : (formData.customerEmail || `${formData.customerName.toLowerCase().replace(/\s+/g, '')}@customer.mv`);
      
      const orderData: any = {
        customerName: formData.customerName,
        customerEmail,
        customerPhone: formData.customerPhone,
        shippingAddress: formData.shippingAddress,
        deliveryType: deliveryLocation,
        items: inStockItems.map(item => {
          const stock = getItemLiveStock(item);
          const cappedQty = (item as any).isPreOrder ? item.quantity : Math.min(item.quantity, stock);
          return {
            productId: item.id,
            name: item.name,
            qty: cappedQty,
            price: item.price,
            color: item.selectedColor,
            size: item.selectedSize,
            isPreOrder: (item as any).isPreOrder || false,
            preOrderTotalPrice: (item as any).preOrderTotalPrice,
            preOrderEta: (item as any).preOrderEta
          };
        }),
        subtotal,
        discount,
        shipping: 0,
        total,
        paymentMethod: paymentMethod as "cod" | "bank",
        paymentSlip: paymentSlipPath || undefined,
        couponCode: appliedCoupon?.code,
        status: paymentMethod === "bank" ? "payment_verification" : "pending",
        notes: formData.notes || null
      };

      // Add boat-specific fields if boat delivery
      if (deliveryLocation === "boat") {
        orderData.boatName = formData.boatName;
        orderData.boatNumber = formData.boatNumber;
        orderData.boatLocation = formData.boatLocation;
      }

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
              <h2 className="text-2xl font-serif mb-6">Delivery Location</h2>
              <div className="grid gap-4 mb-6">
                <Button
                  variant={deliveryLocation === "male" ? "default" : "outline"}
                  className="rounded-none h-12 uppercase tracking-widest text-sm font-bold text-left justify-start"
                  onClick={() => setDeliveryLocation("male")}
                  data-testid="button-delivery-male"
                >
                  <MapPin size={18} className="mr-3" /> Male Delivery
                </Button>
                <Button
                  variant={deliveryLocation === "hulhumale" ? "default" : "outline"}
                  className="rounded-none h-12 uppercase tracking-widest text-sm font-bold text-left justify-start"
                  onClick={() => setDeliveryLocation("hulhumale")}
                  data-testid="button-delivery-hulhumale"
                >
                  <MapPin size={18} className="mr-3" /> Hulhumale Delivery
                </Button>
                <Button
                  variant={deliveryLocation === "boat" ? "default" : "outline"}
                  className="rounded-none h-12 uppercase tracking-widest text-sm font-bold text-left justify-start"
                  onClick={() => setDeliveryLocation("boat")}
                  data-testid="button-delivery-boat"
                >
                  <Truck size={18} className="mr-3" /> Boat Delivery
                </Button>
              </div>

              {/* Delivery Type - Standard or Express */}
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <h3 className="font-bold uppercase tracking-widest text-xs">Delivery Type</h3>
                <RadioGroup value={deliveryType} onValueChange={(value) => setDeliveryType(value as "standard" | "express")} className="grid gap-4">
                  <Label
                    className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${deliveryType === "standard" ? "border-primary bg-secondary/10" : "border-border"}`}
                    data-testid="delivery-type-standard"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="standard" />
                      <div className="flex items-center gap-2">
                        <Truck size={16} />
                        <span className="font-medium">Standard Delivery</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-600">FREE</span>
                  </Label>
                  {isExpressAvailable && (
                    <Label
                      className={`flex items-center justify-between p-4 border cursor-pointer transition-colors ${deliveryType === "express" ? "border-primary bg-secondary/10" : "border-border"}`}
                      data-testid="delivery-type-express"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="express" />
                        <div className="flex items-center gap-2">
                          <Zap size={16} />
                          <div>
                            <span className="font-medium">Express Delivery</span>
                            <p className="text-xs text-muted-foreground mt-1">Delivery within 1-6 hours (Orders after 10 PM delivered next morning)</p>
                          </div>
                        </div>
                      </div>
                      {expressCharge > 0 && (
                        <span className="text-sm font-bold">+{formatCurrency(expressCharge)}</span>
                      )}
                    </Label>
                  )}
                </RadioGroup>
              </div>

              {/* Conditional Form Fields Based on Delivery Location */}
              {deliveryLocation !== "boat" ? (
                // Male / Hulhumale Delivery Form
                <div className="space-y-4 mt-6 pt-6 border-t border-border">
                  <h3 className="font-bold uppercase tracking-widest text-xs">Delivery Details</h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="Full Name *"
                      className="rounded-none h-12"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      data-testid="input-delivery-name"
                    />
                    <Input
                      placeholder="Email *"
                      type="email"
                      className="rounded-none h-12"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                      data-testid="input-delivery-email"
                    />
                    <Input
                      placeholder="Street Address *"
                      className="rounded-none h-12"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                      data-testid="input-delivery-address"
                    />
                    <Input
                      placeholder="Phone Number *"
                      className="rounded-none h-12"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      data-testid="input-delivery-phone"
                    />
                    <textarea
                      placeholder="Additional Notes (Optional)"
                      className="w-full p-3 border border-border rounded-none bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[80px]"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      data-testid="textarea-delivery-notes"
                    />
                  </div>
                </div>
              ) : (
                // Boat Delivery Form
                <div className="space-y-4 mt-6 pt-6 border-t border-border">
                  <h3 className="font-bold uppercase tracking-widest text-xs">Boat Delivery Details</h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="Full Name *"
                      className="rounded-none h-12"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      data-testid="input-boat-name"
                    />
                    <Input
                      placeholder="Email *"
                      type="email"
                      className="rounded-none h-12"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                      data-testid="input-boat-email"
                    />
                    <Input
                      placeholder="Street Address *"
                      className="rounded-none h-12"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                      data-testid="input-boat-address"
                    />
                    <Input
                      placeholder="Phone Number *"
                      className="rounded-none h-12"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      data-testid="input-boat-phone"
                    />
                    <Input
                      placeholder="Boat Name *"
                      className="rounded-none h-12"
                      value={formData.boatName}
                      onChange={(e) => setFormData({...formData, boatName: e.target.value})}
                      data-testid="input-boat-name-field"
                    />
                    <Input
                      placeholder="Boat Contact Number *"
                      className="rounded-none h-12"
                      value={formData.boatNumber}
                      onChange={(e) => setFormData({...formData, boatNumber: e.target.value})}
                      data-testid="input-boat-number"
                    />
                    <Input
                      placeholder="Boat Location / Mooring Point *"
                      className="rounded-none h-12"
                      value={formData.boatLocation}
                      onChange={(e) => setFormData({...formData, boatLocation: e.target.value})}
                      data-testid="input-boat-location"
                    />
                    <textarea
                      placeholder="Additional Notes (Optional)"
                      className="w-full p-3 border border-border rounded-none bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[80px]"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      data-testid="textarea-boat-notes"
                    />
                  </div>
                </div>
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
                    <div className="space-y-1">
                      <p className="font-medium underline">Bank of Maldives (BML)</p>
                      <p>Account Name: INFINITE LOOP PVT LTD</p>
                      <p>Account Number: 7730000725601 (MVR)</p>
                    </div>
                    <div className="space-y-1 pt-2">
                      <p className="font-medium underline">Maldives Islamic Bank (MIB)</p>
                      <p>Account Name: INFINITE LOOP</p>
                      <p>Account Number: 90401480025761000 (MVR)</p>
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-2 italic">Please include your order ID as the transfer remark.</p>
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
                  <div className="space-y-1">
                    <p className="text-[10px] text-green-700 font-bold uppercase tracking-widest">
                      Code {appliedCoupon.code} applied! (MVR {eligibleDiscount.toFixed(2)} off)
                    </p>
                    {couponMessage && (
                      <p className="text-[10px] text-amber-600">{couponMessage}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-6">
                {items.map((item, index) => {
                  const liveStock = getItemLiveStock(item);
                  const isPreOrderItem = (item as any).isPreOrder;
                  const isInStock = isPreOrderItem || liveStock > 0;
                  const quantityExceedsStock = !isPreOrderItem && liveStock > 0 && (item.quantity || 0) > liveStock;
                  const hasIssue = !isInStock || quantityExceedsStock;
                  const preOrderTotalPrice = (item as any).preOrderTotalPrice;
                  const preOrderEta = (item as any).preOrderEta;
                  const balanceDue = isPreOrderItem && preOrderTotalPrice ? (preOrderTotalPrice - item.price) * (item.quantity || 0) : 0;
                  return (
                    <div key={`${item.id}-${index}`} className={`flex justify-between text-sm ${!isInStock ? 'opacity-50' : ''}`}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${hasIssue ? 'text-destructive' : 'text-muted-foreground'} ${!isInStock ? 'line-through' : ''}`}>
                            {item.name} x {item.quantity}
                            {!isInStock && " (Out of Stock)"}
                            {isInStock && quantityExceedsStock && ` (Only ${liveStock} available)`}
                          </span>
                          {isPreOrderItem && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-800 uppercase tracking-widest font-bold">Pre-Order</span>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {[
                            item.selectedColor && item.selectedColor !== 'Default' ? item.selectedColor : '',
                            item.selectedSize && item.selectedSize !== 'Standard' ? item.selectedSize : ''
                          ].filter(Boolean).join(' / ')}
                        </span>
                        {isPreOrderItem && preOrderEta && (
                          <span className="text-[10px] text-amber-700">ETA: {preOrderEta}</span>
                        )}
                        {isPreOrderItem && balanceDue > 0 && (
                          <span className="text-[10px] text-muted-foreground">Balance due on delivery: {formatCurrency(balanceDue)}</span>
                        )}
                      </div>
                      <div className="text-right">
                        {isInStock ? (
                          <span className={hasIssue ? 'text-destructive' : ''}>
                            {formatCurrency(item.price * (item.quantity || 0))}
                          </span>
                        ) : (
                          <span className="text-destructive text-xs font-bold">Excluded</span>
                        )}
                        {isPreOrderItem && isInStock && (
                          <div className="text-[10px] text-muted-foreground">deposit</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasOutOfStockItems && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive text-destructive text-[10px] uppercase tracking-widest font-bold">
                  Out of stock items have been excluded from your order total.
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
                  <span className="text-muted-foreground">
                    {deliveryType === "express" ? "Express Delivery" : "Standard Delivery"}
                  </span>
                  <span className={expressCharge > 0 ? "" : "text-green-600"}>
                    {expressCharge > 0 ? `+${formatCurrency(expressCharge)}` : "FREE"}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span data-testid="text-total">{formatCurrency(total)}</span>
                </div>
              </div>
              <Button 
                onClick={handlePlaceOrder}
                className="w-full h-12 rounded-none mt-6 uppercase tracking-widest font-bold"
                disabled={
                  isSubmitting || 
                  inStockItems.length === 0 || 
                  !formData.customerName || 
                  !formData.shippingAddress || 
                  !formData.customerPhone || 
                  !formData.customerEmail || 
                  (paymentMethod === "bank" && !paymentSlipPath) ||
                  (deliveryLocation === "boat" && (!formData.boatName || !formData.boatNumber || !formData.boatLocation))
                }
                data-testid="button-place-order"
              >
                {isSubmitting ? "Processing..." : (inStockItems.length === 0 ? "No Items Available" : (paymentMethod === "bank" && !paymentSlipPath ? "Upload Slip to Proceed" : "Place Order"))}
              </Button>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
