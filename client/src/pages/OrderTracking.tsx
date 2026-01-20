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
}

const statusConfig: Record<OrderStatus, { label: string; description: string; icon: React.ReactNode }> = {
  pending: {
    label: "Order Pending",
    description: "Your order has been received and is awaiting confirmation.",
    icon: <Clock size={24} />,
  },
  confirmed: {
    label: "Order Confirmed",
    description: "Your order has been confirmed and payment verified.",
    icon: <CheckCircle2 size={24} />,
  },
  processing: {
    label: "Processing",
    description: "Your items are being carefully packed and prepared for shipment.",
    icon: <Package size={24} />,
  },
  shipped: {
    label: "Shipped",
    description: "Your package has been handed over to our delivery partner.",
    icon: <PackageCheck size={24} />,
  },
  in_transit: {
    label: "In Transit",
    description: "Your package is on its way and moving through our delivery network.",
    icon: <Truck size={24} />,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    description: "Your package is with the delivery driver and will arrive today.",
    icon: <Home size={24} />,
  },
  delivered: {
    label: "Delivered",
    description: "Your package has been successfully delivered. Enjoy your purchase!",
    icon: <CheckCircle2 size={24} />,
  },
  delivery_exception: {
    label: "Delivery Exception",
    description: "There was an issue with delivery. Our team is working to resolve it.",
    icon: <AlertTriangle size={24} />,
  },
  payment_verification: {
    label: "Payment Verification",
    description: "We are verifying your bank transfer. This usually takes 1-2 business hours.",
    icon: <CreditCard size={24} />,
  },
};

const normalFlow: OrderStatus[] = ["confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];

function getTrackingSteps(currentStatus: OrderStatus): TrackingStep[] {
  const steps: TrackingStep[] = [];
  
  if (currentStatus === "payment_verification") {
    steps.push({
      status: "payment_verification",
      ...statusConfig.payment_verification,
      isCompleted: false,
      isCurrent: true,
    });
    normalFlow.forEach((status) => {
      steps.push({
        status,
        ...statusConfig[status],
        isCompleted: false,
        isCurrent: false,
      });
    });
    return steps;
  }

  if (currentStatus === "delivery_exception") {
    const preExceptionFlow: OrderStatus[] = ["confirmed", "processing", "shipped", "in_transit"];
    preExceptionFlow.forEach((status) => {
      steps.push({
        status,
        ...statusConfig[status],
        isCompleted: true,
        isCurrent: false,
      });
    });
    steps.push({
      status: "delivery_exception",
      ...statusConfig.delivery_exception,
      isCompleted: false,
      isCurrent: true,
      isException: true,
    });
    return steps;
  }

  const currentIndex = normalFlow.indexOf(currentStatus);
  
  normalFlow.forEach((status, idx) => {
    steps.push({
      status,
      ...statusConfig[status],
      isCompleted: idx < currentIndex || (idx === currentIndex && status === "delivered"),
      isCurrent: idx === currentIndex && status !== "delivered",
    });
  });

  if (currentStatus === "delivered") {
    steps[steps.length - 1].isCompleted = true;
    steps[steps.length - 1].isCurrent = false;
  }

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
        setTrackingSteps(getTrackingSteps(orderData.status as OrderStatus));
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
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
                <div className="absolute left-[27px] top-8 bottom-8 w-1 bg-gradient-to-b from-primary/30 via-border to-border hidden md:block rounded-full" />
                
                <div className="space-y-0">
                  {trackingSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "relative flex items-start gap-6 py-6 transition-all",
                        idx !== trackingSteps.length - 1 && "border-b border-border/50"
                      )}
                    >
                      <div className={cn(
                        "z-10 w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 shadow-sm",
                        step.isException 
                          ? "bg-red-500 text-white ring-4 ring-red-100" 
                          : step.isCompleted 
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20" 
                            : step.isCurrent 
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/30 animate-pulse" 
                              : "bg-muted text-muted-foreground"
                      )}>
                        {step.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                          <h3 className={cn(
                            "text-xl font-serif font-medium",
                            step.isException 
                              ? "text-red-600" 
                              : step.isCurrent 
                                ? "text-primary" 
                                : step.isCompleted 
                                  ? "text-foreground" 
                                  : "text-muted-foreground"
                          )}>
                            {step.label}
                          </h3>
                          {step.isCompleted && !step.isException && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                              <CheckCircle2 size={14} />
                              Completed
                            </span>
                          )}
                          {step.isCurrent && !step.isException && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                              <Clock size={14} />
                              In Progress
                            </span>
                          )}
                          {step.isException && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                              <AlertTriangle size={14} />
                              Action Required
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          "text-base max-w-lg",
                          step.isCompleted || step.isCurrent ? "text-muted-foreground" : "text-muted-foreground/60"
                        )}>
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
                    Please contact our support at <strong>support@infinitehome.mv</strong> or call <strong>+960 123 4567</strong>
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
