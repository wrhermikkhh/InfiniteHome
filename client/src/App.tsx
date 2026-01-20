import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductPage from "@/pages/ProductPage";
import Consultation from "@/pages/Consultation";
import OrderTracking from "@/pages/OrderTracking";
import AdminPanel from "@/pages/AdminPanel";
import Checkout from "@/pages/Checkout";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import Returns from "@/pages/Returns";
import Shipping from "@/pages/Shipping";
import Contact from "@/pages/Contact";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:id" component={ProductPage} />
      <Route path="/consultation" component={Consultation} />
      <Route path="/track" component={OrderTracking} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/returns" component={Returns} />
      <Route path="/shipping" component={Shipping} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
