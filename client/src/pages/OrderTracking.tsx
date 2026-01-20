import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Package, Truck, CheckCircle2, Search, Clock, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";
import { api, Order } from "@/lib/api";

type Status = "ordered" | "processing" | "shipped" | "delivered" | "payment_verification";

interface TrackingStep {
  status: Status;
  label: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

const statusOrder: Status[] = ["ordered", "processing", "shipped", "delivered"];

function getTrackingSteps(currentStatus: string): TrackingStep[] {
  const steps: TrackingStep[] = [];
  
  steps.push({
    status: "ordered",
    label: "Order Placed",
    description: "We've received your order and it's being prepared.",
    isCompleted: true,
    isCurrent: currentStatus === "ordered",
  });

  if (currentStatus === "payment_verification") {
    steps.push({
      status: "payment_verification",
      label: "Payment Verification",
      description: "We are verifying your bank transfer. This usually takes 1-2 hours.",
      isCompleted: false,
      isCurrent: true,
    });
  }

  const currentIndex = statusOrder.indexOf(currentStatus as Status);

  steps.push(
    {
      status: "processing",
      label: "Processing",
      description: "Your items are being carefully packed and quality checked.",
      isCompleted: currentIndex >= 1,
      isCurrent: currentStatus === "processing",
    },
    {
      status: "shipped",
      label: "Shipped",
      description: "Your package is on its way to your destination.",
      isCompleted: currentIndex >= 2,
      isCurrent: currentStatus === "shipped",
    },
    {
      status: "delivered",
      label: "Delivered",
      description: "Package has been delivered to your address.",
      isCompleted: currentIndex >= 3,
      isCurrent: currentStatus === "delivered",
    }
  );

  return steps;
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
        setError("Order not found. Please check your order number.");
        setOrder(null);
        setTrackingSteps(null);
      } else {
        const orderData = await res.json();
        setOrder(orderData);
        setTrackingSteps(getTrackingSteps(orderData.status));
      }
    } catch (err) {
      setError("Failed to fetch order. Please try again.");
      setOrder(null);
      setTrackingSteps(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = () => {
    fetchOrder(orderNumber);
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      <div className="pt-32 pb-24 container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-serif mb-4">Track Your Order</h1>
          <p className="text-muted-foreground">Enter your order number to see the current status of your delivery.</p>
        </div>

        <div className="bg-white p-8 border border-border shadow-sm mb-12">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Order Number (e.g. IH-12345)" 
                className="pl-10 rounded-none h-12"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                data-testid="input-order-number"
              />
            </div>
            <Button 
              onClick={handleTrack}
              disabled={loading}
              className="rounded-none h-12 px-8 uppercase tracking-widest font-bold"
              data-testid="button-track-order"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Track Order"}
            </Button>
          </div>
          
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {order && trackingSteps && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-secondary/20 p-6 flex flex-col md:flex-row justify-between items-center gap-6 border border-border">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <Package className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Order ID</p>
                  <p className="font-medium" data-testid="text-order-number">{order.orderNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <Clock className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Status</p>
                  <p className="font-medium capitalize" data-testid="text-order-status">{order.status.replace("_", " ")}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <MapPin className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Destination</p>
                  <p className="font-medium">{order.shippingAddress.split(",")[0]}</p>
                </div>
              </div>
            </div>

            <div className="relative py-12">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border hidden md:block" />
              <div className="space-y-12">
                {trackingSteps.map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-8">
                    <div className={cn(
                      "z-10 w-16 h-16 rounded-full border-4 border-background flex items-center justify-center shrink-0",
                      step.isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border-muted"
                    )}>
                      {step.isCompleted ? <CheckCircle2 size={24} /> : <Package size={24} />}
                    </div>
                    <div className="flex-1 pt-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                        <h3 className={cn("text-xl font-serif", step.isCurrent ? "text-primary" : "text-foreground")}>
                          {step.label}
                        </h3>
                        {step.isCompleted && (
                          <span className="text-sm font-medium text-green-600">Completed</span>
                        )}
                        {step.isCurrent && !step.isCompleted && (
                          <span className="text-sm font-medium text-amber-600">In Progress</span>
                        )}
                      </div>
                      <p className="text-muted-foreground max-w-md">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
