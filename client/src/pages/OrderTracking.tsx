import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Package, Truck, CheckCircle2, Search, Clock, MapPin, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";

type Status = "ordered" | "processing" | "shipped" | "delivered" | "payment_verification";

interface TrackingStep {
  status: Status;
  label: string;
  date: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export default function OrderTracking() {
  const [orderId, setOrderId] = useState("");
  const [trackingData, setTrackingData] = useState<TrackingStep[] | null>(null);
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const id = params.get("id");
    const status = params.get("status") as Status;
    if (id) {
      setOrderId(id);
      generateTracking(id, status || "ordered");
    }
  }, [search]);

  const generateTracking = (id: string, currentStatus: Status) => {
    const steps: TrackingStep[] = [
      {
        status: "ordered",
        label: "Order Placed",
        date: "Jan 18, 2026",
        description: "We've received your order and it's being prepared.",
        isCompleted: true,
        isCurrent: currentStatus === "ordered",
      },
    ];

    if (currentStatus === "payment_verification") {
      steps.push({
        status: "payment_verification",
        label: "Payment Verification",
        date: "Jan 19, 2026",
        description: "We are verifying your bank transfer. This usually takes 1-2 hours.",
        isCompleted: false,
        isCurrent: true,
      });
    }

    steps.push(
      {
        status: "processing",
        label: "Processing",
        date: currentStatus === "processing" ? "Jan 19, 2026" : "Pending",
        description: "Your items are being carefully packed and quality checked.",
        isCompleted: currentStatus !== "ordered" && currentStatus !== "payment_verification",
        isCurrent: currentStatus === "processing",
      },
      {
        status: "shipped",
        label: "Shipped",
        date: "Pending",
        description: "Your package is on its way to your destination.",
        isCompleted: false,
        isCurrent: currentStatus === "shipped",
      },
      {
        status: "delivered",
        label: "Delivered",
        date: "Pending",
        description: "Package has been delivered to your address.",
        isCompleted: false,
        isCurrent: currentStatus === "delivered",
      }
    );
    
    setTrackingData(steps);
  };

  const mockTrack = () => {
    if (!orderId) return;
    generateTracking(orderId, "processing");
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
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>
            <Button 
              onClick={mockTrack}
              className="rounded-none h-12 px-8 uppercase tracking-widest font-bold"
            >
              Track Order
            </Button>
          </div>
        </div>

        {trackingData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-secondary/20 p-6 flex flex-col md:flex-row justify-between items-center gap-6 border border-border">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <Package className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Order ID</p>
                  <p className="font-medium">{orderId}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <Clock className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Estimated Delivery</p>
                  <p className="font-medium">Jan 22 - Jan 24, 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3">
                  <MapPin className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Destination</p>
                  <p className="font-medium">Male', Maldives</p>
                </div>
              </div>
            </div>

            <div className="relative py-12">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border hidden md:block" />
              <div className="space-y-12">
                {trackingData.map((step, idx) => (
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
                        <span className="text-sm font-medium text-muted-foreground">{step.date}</span>
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
