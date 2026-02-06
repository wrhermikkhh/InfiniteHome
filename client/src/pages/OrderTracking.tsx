import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Search, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Loader2,
  PackageCheck,
  CircleDot,
  Home,
  AlertTriangle,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";
import { Order } from "@/lib/api";

export type OrderStatus = 
  | "pending"
  | "confirmed" 
  | "processing" 
  | "shipped" 
  | "in_transit"
  | "out_for_delivery"
  | "delivered" 
  | "delivery_exception"
  | "payment_verification";

interface TrackingStep {
  status: OrderStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  isCurrent: boolean;
  isException?: boolean;
  timestamp?: string;
}

const statusConfig: Record<OrderStatus, { label: string; description: string; icon: React.ReactNode }> = {
  pending: {
    label: "Order Placed",
    description: "Your order has been received and is awaiting confirmation.",
    icon: <Clock size={20} />,
  },
  confirmed: {
    label: "Order Confirmed",
    description: "Your order has been confirmed and payment verified.",
    icon: <CheckCircle2 size={20} />,
  },
  processing: {
    label: "Processing",
    description: "Your items are being carefully packed and prepared for shipment.",
    icon: <Package size={20} />,
  },
  shipped: {
    label: "Shipped",
    description: "Your package has been handed over to our delivery partner.",
    icon: <PackageCheck size={20} />,
  },
  in_transit: {
    label: "In Transit",
    description: "Your package is on its way and moving through our delivery network.",
    icon: <Truck size={20} />,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    description: "Your package is with the delivery driver and will arrive today.",
    icon: <Home size={20} />,
  },
  delivered: {
    label: "Delivered",
    description: "Your package has been successfully delivered. Enjoy your purchase!",
    icon: <CheckCircle2 size={20} />,
  },
  delivery_exception: {
    label: "Delivery Exception",
    description: "There was an issue with delivery. Our team is working to resolve it.",
    icon: <AlertTriangle size={20} />,
  },
  payment_verification: {
    label: "Payment Verification",
    description: "We are verifying your bank transfer. This usually takes 1-2 business hours.",
    icon: <CreditCard size={20} />,
  },
};

const normalFlow: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];

function normalizeStatus(status: string): OrderStatus {
  if (status === "ordered") return "pending";
  return status as OrderStatus;
}

function formatGMT5(isoString: string): string {
  const date = new Date(isoString);
  const gmt5 = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const day = gmt5.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[gmt5.getUTCMonth()];
  const year = gmt5.getUTCFullYear();
  let hours = gmt5.getUTCHours();
  const minutes = gmt5.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

function getTrackingSteps(rawStatus: string, statusHistory?: { status: string; timestamp: string }[], createdAt?: string): TrackingStep[] {
  const currentStatus = normalizeStatus(rawStatus);
  const history = statusHistory || [];

  if (history.length === 0) {
    const config = statusConfig[currentStatus];
    if (config) {
      return [{
        status: currentStatus,
        ...config,
        isCompleted: currentStatus === "delivered",
        isCurrent: currentStatus !== "delivered",
        isException: currentStatus === "delivery_exception",
        timestamp: createdAt,
      }];
    }
    return [];
  }

  const steps: TrackingStep[] = [];
  const lastIdx = history.length - 1;

  history.forEach((h, idx) => {
    const status = normalizeStatus(h.status);
    const config = statusConfig[status];
    if (!config) return;
    const isLast = idx === lastIdx;
    const isDelivered = status === "delivered" && isLast;
    steps.push({
      status,
      ...config,
      isCompleted: !isLast || isDelivered,
      isCurrent: isLast && !isDelivered,
      isException: status === "delivery_exception",
      timestamp: h.timestamp,
    });
  });

  return steps;
}

function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case "delivered":
      return "text-green-600";
    case "delivery_exception":
      return "text-red-600";
    case "out_for_delivery":
      return "text-blue-600";
    case "in_transit":
      return "text-indigo-600";
    default:
      return "text-primary";
  }
}

function getStatusBadge(status: OrderStatus): { bg: string; text: string } {
  switch (status) {
    case "delivered":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "delivery_exception":
      return { bg: "bg-red-100", text: "text-red-800" };
    case "out_for_delivery":
      return { bg: "bg-blue-100", text: "text-blue-800" };
    case "in_transit":
      return { bg: "bg-indigo-100", text: "text-indigo-800" };
    case "payment_verification":
      return { bg: "bg-amber-100", text: "text-amber-800" };
    default:
      return { bg: "bg-primary/10", text: "text-primary" };
  }
}

export default function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingSteps, setTrackingSteps] = useState<TrackingStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get("id");
    if (id) {
      setOrderNumber(id);
      fetchOrder(id);
    }
  }, [search]);

  const fetchOrder = async (num: string) => {
    if (!num.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/orders/track/${num}`);
      if (!res.ok) {
        setError("Order not found. Please check your order number and try again.");
        setOrder(null);
        setTrackingSteps(null);
      } else {
        const orderData = await res.json();
        setOrder(orderData);
        setTrackingSteps(getTrackingSteps(orderData.status, orderData.statusHistory, orderData.createdAt));
      }
    } catch (err) {
      setError("Unable to fetch order details. Please try again later.");
      setOrder(null);
      setTrackingSteps(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = () => {
    fetchOrder(orderNumber);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return formatGMT5(dateString);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <Truck className="text-primary" size={32} />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4">Track Your Order</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Enter your order number to get real-time updates on your delivery status.
          </p>
        </div>

        <div className="bg-white p-8 md:p-10 border border-border shadow-lg rounded-sm mb-12">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input 
                placeholder="Enter order number (e.g. IH-12345)" 
                className="pl-12 rounded-sm h-14 text-lg border-2 focus:border-primary"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                data-testid="input-order-number"
              />
            </div>
            <Button 
              onClick={handleTrack}
              disabled={loading || !orderNumber.trim()}
              className="rounded-sm h-14 px-10 text-base uppercase tracking-widest font-bold shadow-md hover:shadow-lg transition-shadow"
              data-testid="button-track-order"
            >
              {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Search className="mr-2" size={20} />}
              Track
            </Button>
          </div>
          
          {error && (
            <div className="mt-6 flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-sm border border-red-200">
              <AlertCircle size={20} />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        {order && trackingSteps && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white border border-border shadow-lg rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-border">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Order Number</p>
                    <p className="text-2xl font-serif font-semibold" data-testid="text-order-number">{order.orderNumber}</p>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-full font-semibold text-sm uppercase tracking-wide",
                    getStatusBadge(order.status as OrderStatus).bg,
                    getStatusBadge(order.status as OrderStatus).text
                  )} data-testid="text-order-status">
                    {statusConfig[order.status as OrderStatus]?.label || order.status}
                  </div>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full shrink-0">
                    <Package className="text-primary" size={22} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Items</p>
                    <p className="font-medium">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full shrink-0">
                    <Clock className="text-primary" size={22} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Order Date</p>
                    <p className="font-medium">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full shrink-0">
                    <MapPin className="text-primary" size={22} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Delivery Address</p>
                    <p className="font-medium">{order.shippingAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border shadow-lg rounded-sm p-8 md:p-10">
              <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                <CircleDot className="text-primary" size={24} />
                Tracking Timeline
              </h2>
              
              <div className="relative">
                <div className="space-y-0">
                  {trackingSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className="relative flex gap-0"
                    >
                      <div className="w-[130px] md:w-[160px] shrink-0 pr-4 pt-5 text-right">
                        {step.timestamp && (
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">
                              {(() => {
                                const d = new Date(step.timestamp);
                                const gmt5 = new Date(d.getTime() + 5 * 60 * 60 * 1000);
                                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                return `${gmt5.getUTCDate()} ${months[gmt5.getUTCMonth()]} ${gmt5.getUTCFullYear()}`;
                              })()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(() => {
                                const d = new Date(step.timestamp);
                                const gmt5 = new Date(d.getTime() + 5 * 60 * 60 * 1000);
                                let hours = gmt5.getUTCHours();
                                const minutes = gmt5.getUTCMinutes().toString().padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12 || 12;
                                return `${hours}:${minutes} ${ampm}`;
                              })()}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center shrink-0">
                        <div className={cn(
                          "z-10 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
                          step.isException 
                            ? "bg-red-500 text-white ring-4 ring-red-100" 
                            : step.isCurrent 
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/30 animate-pulse" 
                              : step.isCompleted 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted text-muted-foreground"
                        )}>
                          {step.isCompleted && !step.isException ? <CheckCircle2 size={20} /> : step.icon}
                        </div>
                        {idx !== trackingSteps.length - 1 && (
                          <div className={cn(
                            "w-0.5 flex-1 min-h-[40px]",
                            step.isCompleted ? "bg-primary" : "bg-border"
                          )} />
                        )}
                      </div>

                      <div className="flex-1 pl-4 pb-8 pt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn(
                            "text-base font-semibold",
                            step.isException 
                              ? "text-red-600" 
                              : step.isCurrent 
                                ? "text-primary" 
                                : "text-foreground"
                          )}>
                            {step.label}
                          </h3>
                          {step.isCurrent && !step.isException && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Clock size={10} />
                              Current
                            </span>
                          )}
                          {step.isException && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <AlertTriangle size={10} />
                              Action Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {order.status === "delivery_exception" && (
              <div className="bg-red-50 border-2 border-red-200 rounded-sm p-6 flex items-start gap-4">
                <div className="bg-red-100 p-3 rounded-full shrink-0">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-semibold text-red-800 mb-2">Delivery Exception</h3>
                  <p className="text-red-700 mb-4">
                    There was an issue delivering your package. This could be due to an incorrect address, 
                    recipient not available, or weather conditions. Our team is working to resolve this.
                  </p>
                  <p className="text-sm text-red-600">
                    Please contact our support at <strong>support@infinitehome.mv</strong> or call <strong>7840001</strong> / WhatsApp <strong>9607840001</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!order && !loading && !error && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-muted rounded-full mb-6">
              <Package className="text-muted-foreground" size={40} />
            </div>
            <h3 className="text-xl font-serif text-muted-foreground mb-2">Enter your order number above</h3>
            <p className="text-muted-foreground/70">You can find your order number in your confirmation email</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
