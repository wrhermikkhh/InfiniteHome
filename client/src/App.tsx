import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
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
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Account from "@/pages/Account";
import SizeGuide from "@/pages/SizeGuide";
import CustomMattress from "@/pages/CustomMattress";

function PageTitle() {
  const [location] = useLocation();
  
  useEffect(() => {
    const baseTitle = "WELCOME INFINITE HOME";
    let pageName = "";
    
    if (location === "/") {
      pageName = "Home";
    } else {
      // Convert /contact to Contact, /order-tracking to Order Tracking
      const path = location.split("/")[1];
      if (path) {
        pageName = path.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
      }
    }
    
    document.title = pageName ? `${baseTitle} | ${pageName}` : baseTitle;
  }, [location]);
  
  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <PageTitle />
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
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/account" component={Account} />
        <Route path="/size-guide" component={SizeGuide} />
        <Route path="/custom-mattress" component={CustomMattress} />
        <Route component={NotFound} />
      </Switch>
    </>
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
