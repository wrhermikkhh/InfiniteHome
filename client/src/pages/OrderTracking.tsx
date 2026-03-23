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
  CreditCard,
  Tag,
  MessageSquare,
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
  status: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  isCurrent: boolean;
  isException?: boolean;
  timestamp?: string;
  isDeliveryStep?: boolean;
}

const statusConfig: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
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

const deliveryStepConfig: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  label_created: {
    label: "Label Created",
    description: "Your shipping label has been generated and your order is being prepared for dispatch.",
    icon: <Tag size={20} />,
  },
  processing: {
    label: "Package Processing",
    description: "Your package is being processed and prepared for handover to our courier.",
    icon: <Package size={20} />,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    description: "Your package is with the delivery driver and will arrive today.",
    icon: <Truck size={20} />,
  },
  delivered: {
    label: "Delivered",
    description: "Your package has been successfully delivered. Enjoy your purchase!",
    icon: <CheckCircle2 size={20} />,
  },
  failed: {
    label: "Delivery Failed",
    description: "We were unable to deliver your package. Please contact our support team.",
    icon: <AlertTriangle size={20} />,
  },
};

const DELIVERY_ORDER = ["label_created", "processing", "out_for_delivery", "delivered"];

function normalizeStatus(status: string): string {
  if (status === "ordered") return "pending";
  return status;
}

function formatGMT5(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);
  const gmt5 = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const day = gmt5.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[gmt5.getUTCMonth()];
  const year = gmt5.getUTCFullYear();
  let hours = gmt5.getUTCHours();
  const minutes = gmt5.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return { date: `${day} ${month} ${year}`, time: `${hours}:${minutes} ${ampm}` };
}

function buildOrderTimeline(
  rawStatus: string,
  statusHistory?: { status: string; timestamp: string }[],
  createdAt?: string,
  deliveryStatus?: string | null,
  deliveryStatusHistory?: { status: string; timestamp: string }[]
): TrackingStep[] {
  const history = statusHistory || [];
  const steps: TrackingStep[] = [];

  if (history.length === 0) {
    const st = normalizeStatus(rawStatus);
    const config = statusConfig[st];
    if (config) {
      steps.push({
        status: st,
        ...config,
        isCompleted: st === "delivered",
        isCurrent: st !== "delivered",
        isException: st === "delivery_exception",
        timestamp: createdAt,
      });
    }
  } else {
    const lastIdx = history.length - 1;
    history.forEach((h, idx) => {
      const st = normalizeStatus(h.status);
      const config = statusConfig[st];
      if (!config) return;
      const isLast = idx === lastIdx;
      const isDelivered = st === "delivered" && isLast;
      steps.push({
        status: st,
        ...config,
        isCompleted: !isLast || isDelivered || !!deliveryStatus,
        isCurrent: isLast && !isDelivered && !deliveryStatus,
        isException: st === "delivery_exception",
        timestamp: h.timestamp,
        isDeliveryStep: false,
      });
    });
  }

  if (deliveryStatus) {
    const isFailed = deliveryStatus === "failed";
    const currentDeliveryIdx = isFailed ? -1 : DELIVERY_ORDER.indexOf(deliveryStatus);
    const dHistory = deliveryStatusHistory || [];

    DELIVERY_ORDER.forEach((key, idx) => {
      const cfg = deliveryStepConfig[key];
      const histEntry = dHistory.find(h => h.status === key);
      const isAtCurrent = !isFailed && idx === currentDeliveryIdx;
      const isPastEvent = key === 'label_created'; // label creation is an instant past event
      steps.push({
        status: key,
        label: cfg.label,
        description: cfg.description,
        icon: cfg.icon,
        isCompleted: !isFailed && (idx < currentDeliveryIdx || (isAtCurrent && isPastEvent)),
        isCurrent: isAtCurrent && !isPastEvent,
        isException: false,
        timestamp: histEntry?.timestamp,
        isDeliveryStep: true,
      });
    });

    if (isFailed) {
      const cfg = deliveryStepConfig.failed;
      const histEntry = dHistory.find(h => h.status === "failed");
      steps.push({
        status: "failed",
        label: cfg.label,
        description: cfg.description,
        icon: cfg.icon,
        isCompleted: false,
        isCurrent: true,
        isException: true,
        timestamp: histEntry?.timestamp,
        isDeliveryStep: true,
      });
    }
  }

  return steps;
}

function buildPosTimeline(deliveryStatus?: string | null, deliveryStatusHistory?: { status: string; timestamp: string }[]): TrackingStep[] {
  if (!deliveryStatus) return [];
  const isFailed = deliveryStatus === "failed";
  const currentDeliveryIdx = isFailed ? -1 : DELIVERY_ORDER.indexOf(deliveryStatus);
  const dHistory = deliveryStatusHistory || [];

  const steps: TrackingStep[] = DELIVERY_ORDER.map((key, idx) => {
    const cfg = deliveryStepConfig[key];
    const histEntry = dHistory.find(h => h.status === key);
    const isAtCurrent = !isFailed && idx === currentDeliveryIdx;
    const isPastEvent = key === 'label_created';
    return {
      status: key,
      label: cfg.label,
      description: cfg.description,
      icon: cfg.icon,
      isCompleted: !isFailed && (idx < currentDeliveryIdx || (isAtCurrent && isPastEvent)),
      isCurrent: isAtCurrent && !isPastEvent,
      isException: false,
      timestamp: histEntry?.timestamp,
      isDeliveryStep: true,
    };
  });

  if (isFailed) {
    const cfg = deliveryStepConfig.failed;
    const histEntry = dHistory.find(h => h.status === "failed");
    steps.push({
      status: "failed",
      label: cfg.label,
      description: cfg.description,
      icon: cfg.icon,
      isCompleted: false,
      isCurrent: true,
      isException: true,
      timestamp: histEntry?.timestamp,
      isDeliveryStep: true,
    });
  }

  return steps;
}

function getStatusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case "delivered": return { bg: "bg-green-100", text: "text-green-800" };
    case "delivery_exception": return { bg: "bg-red-100", text: "text-red-800" };
    case "out_for_delivery": return { bg: "bg-blue-100", text: "text-blue-800" };
    case "in_transit": return { bg: "bg-indigo-100", text: "text-indigo-800" };
    case "payment_verification": return { bg: "bg-amber-100", text: "text-amber-800" };
    default: return { bg: "bg-primary/10", text: "text-primary" };
  }
}

function Timeline({ steps }: { steps: TrackingStep[] }) {
  const visible = steps.filter(s => s.isCompleted || s.isCurrent || s.isException);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-0">
      {visible.map((step, idx) => (
        <div key={idx} className="relative flex gap-0">
          <div className="w-[130px] md:w-[160px] shrink-0 pr-4 pt-5 text-right">
            {step.timestamp ? (() => {
              const { date, time } = formatGMT5(step.timestamp);
              return (
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{date}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
                </div>
              );
            })() : (
              <p className="text-xs text-muted-foreground/50 pt-1">—</p>
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
            {idx !== visible.length - 1 && (
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
                step.isException ? "text-red-600" : step.isCurrent ? "text-primary" : step.isCompleted ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </h3>
              {step.isCurrent && !step.isException && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock size={10} /> Current
                </span>
              )}
              {step.isException && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <AlertTriangle size={10} /> Action Required
                </span>
              )}
            </div>
            <p className={cn(
              "text-sm mt-1 max-w-md",
              step.isCompleted || step.isCurrent ? "text-muted-foreground" : "text-muted-foreground/50"
            )}>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [posTransaction, setPosTransaction] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get("order") || params.get("id");
    if (id) {
      setOrderNumber(id);
      fetchOrder(id);
    }
  }, [search]);

  const fetchOrder = async (num: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setError("");
    setOrder(null);
    setPosTransaction(null);

    try {
      const res = await fetch(`/api/orders/track/${num}`);
      if (res.ok) {
        setOrder(await res.json());
        setLoading(false);
        return;
      }
    } catch {}

    try {
      const posRes = await fetch(`/api/pos/track/${num}`);
      if (posRes.ok) {
        setPosTransaction(await posRes.json());
        setLoading(false);
        return;
      }
    } catch {}

    setError("Order not found. Please check your order number and try again.");
    setLoading(false);
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

        <div className="bg-white border border-border shadow-sm rounded-sm p-6 md:p-8 mb-8">
          <div className="flex gap-3">
            <Input
              className="rounded-none text-base h-12"
              placeholder="Enter your order or tracking number"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchOrder(orderNumber)}
              data-testid="input-order-number"
            />
            <Button
              className="rounded-none h-12 px-8 uppercase tracking-widest text-xs font-bold gap-2 shrink-0"
              onClick={() => fetchOrder(orderNumber)}
              disabled={loading || !orderNumber.trim()}
              data-testid="button-track-order"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
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

        {/* ── Storefront order ── */}
        {order && (() => {
          const steps = buildOrderTimeline(order.status, (order as any).statusHistory, (order as any).createdAt, (order as any).deliveryStatus, (order as any).deliveryStatusHistory);
          const adminNote = (order as any).adminNote;
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              {/* Header */}
              <div className="bg-white border border-border shadow-lg rounded-sm overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-border">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Order Number</p>
                      <p className="text-2xl font-serif font-semibold" data-testid="text-order-number">{order.orderNumber}</p>
                      {(order as any).trackingNumber && (
                        <p className="text-sm text-muted-foreground mt-1 font-mono">Tracking: {(order as any).trackingNumber}</p>
                      )}
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-full font-semibold text-sm uppercase tracking-wide",
                      getStatusBadge(order.status).bg,
                      getStatusBadge(order.status).text
                    )} data-testid="text-order-status">
                      {statusConfig[order.status]?.label || order.status}
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0"><Package className="text-primary" size={22} /></div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Items</p>
                      <p className="font-medium">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0"><Clock className="text-primary" size={22} /></div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Order Date</p>
                      <p className="font-medium">{(order as any).createdAt ? formatGMT5((order as any).createdAt).date : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0"><MapPin className="text-primary" size={22} /></div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Delivery Address</p>
                      <p className="font-medium">{order.shippingAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified Timeline */}
              <div className="bg-white border border-border shadow-lg rounded-sm p-8 md:p-10">
                <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                  <CircleDot className="text-primary" size={24} />
                  Tracking Timeline
                </h2>
                <Timeline steps={steps} />
                {(order as any).deliveryStatus === "delivery_exception" && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-sm p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-red-800 mb-1">Delivery Exception</p>
                      <p className="text-sm text-red-700">There was an issue delivering your package. Please contact us at <strong>support@infinitehome.mv</strong> or call <strong>7840001</strong>.</p>
                    </div>
                  </div>
                )}
                {(order as any).deliveryStatus === "failed" && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-sm p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-red-800 mb-1">Delivery Failed</p>
                      <p className="text-sm text-red-700">We were unable to deliver your package. Please contact us at <strong>support@infinitehome.mv</strong> or WhatsApp <strong>9607840001</strong>.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Note */}
              {adminNote && (
                <div className="bg-white border border-border shadow-lg rounded-sm p-6 md:p-8 flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full shrink-0">
                    <MessageSquare className="text-primary" size={20} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Note from INFINITE HOME</p>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{adminNote}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── POS delivery order ── */}
        {posTransaction && (() => {
          const deliveryStatus = posTransaction.deliveryStatus || null;
          const steps = buildPosTimeline(deliveryStatus, posTransaction.deliveryStatusHistory);
          const trackingNum = posTransaction.trackingNumber || posTransaction.transactionNumber.replace(/^POS-/, "").replace(/-/g, "");
          const adminNote = posTransaction.adminNote;
          const deliveryStatusLabel: Record<string, string> = {
            label_created: "Label Created", processing: "Processing",
            out_for_delivery: "Out for Delivery", delivered: "Delivered", failed: "Delivery Failed",
          };
          const deliveryStatusBadge: Record<string, string> = {
            label_created: "bg-blue-100 text-blue-800", processing: "bg-amber-100 text-amber-800",
            out_for_delivery: "bg-orange-100 text-orange-800", delivered: "bg-green-100 text-green-800",
            failed: "bg-red-100 text-red-800",
          };
          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
              {/* Header */}
              <div className="bg-white border border-border shadow-lg rounded-sm overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-border">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Tracking Number</p>
                      <p className="text-2xl font-mono font-bold tracking-widest">{trackingNum}</p>
                      <p className="text-xs text-muted-foreground mt-1">Ref: {posTransaction.transactionNumber}</p>
                    </div>
                    {deliveryStatus && (
                      <div className={cn("px-4 py-2 rounded-full font-semibold text-sm uppercase tracking-wide", deliveryStatusBadge[deliveryStatus] || "bg-secondary text-foreground")}>
                        {deliveryStatusLabel[deliveryStatus] || deliveryStatus}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0"><Package className="text-primary" size={22} /></div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Items</p>
                      <p className="font-medium">{posTransaction.items?.length || 0} item{(posTransaction.items?.length || 0) !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  {posTransaction.labelRecipientName && (
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-full shrink-0"><MapPin className="text-primary" size={22} /></div>
                      <div>
                        <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Recipient</p>
                        <p className="font-medium">{posTransaction.labelRecipientName}</p>
                        {posTransaction.labelAddress && <p className="text-sm text-muted-foreground">{posTransaction.labelAddress}</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0"><Clock className="text-primary" size={22} /></div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">Date</p>
                      <p className="font-medium">{posTransaction.createdAt ? formatGMT5(posTransaction.createdAt).date : ""}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified delivery timeline */}
              {steps.length > 0 && (
              <div className="bg-white border border-border shadow-lg rounded-sm p-8 md:p-10">
                <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                  <CircleDot className="text-primary" size={24} />
                  Tracking Timeline
                </h2>
                <Timeline steps={steps} />
                {deliveryStatus === "failed" && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-sm p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-0.5 shrink-0" size={20} />
                    <div>
                      <p className="font-semibold text-red-800 mb-1">Delivery Failed</p>
                      <p className="text-sm text-red-700">We were unable to deliver your package. Please contact us at <strong>support@infinitehome.mv</strong> or call <strong>7840001</strong>.</p>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Items */}
              <div className="bg-white border border-border shadow-lg rounded-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h2 className="text-lg font-serif font-semibold">Items</h2>
                </div>
                <div className="px-6 pb-6 pt-4 space-y-2">
                  {posTransaction.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                      <span>{item.qty}x {item.name}{item.size && item.size !== "Standard" ? ` (${item.size})` : ""}{item.color && item.color !== "Default" ? ` — ${item.color}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Note */}
              {adminNote && (
                <div className="bg-white border border-border shadow-lg rounded-sm p-6 md:p-8 flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full shrink-0">
                    <MessageSquare className="text-primary" size={20} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Note from INFINITE HOME</p>
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">{adminNote}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {!order && !posTransaction && !loading && !error && (
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
