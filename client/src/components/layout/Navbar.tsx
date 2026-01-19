import { Link, useLocation } from "wouter";
import { Search, ShoppingBag, User, Menu, X, Trash2, Plus, Minus, LogOut, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/products";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const cart = useCart();
  const { user, login, logout, isAuthenticated } = useAuth();
  const items = cart.items || [];
  const removeItem = cart.removeItem;
  const updateQuantity = cart.updateQuantity;

  const total = items.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Shop All", href: "/shop" },
    { name: "Bedding", href: "/shop?category=Bedding" },
    { name: "Bath", href: "/shop?category=Bath" },
    { name: "Apparel", href: "/shop?category=Apparel" },
    { name: "Track Order", href: "/track" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent",
        isScrolled || mobileMenuOpen || location !== "/" 
          ? "bg-background/95 backdrop-blur-sm border-border py-3 shadow-sm" 
          : "bg-transparent py-5 text-white"
      )}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <button 
          className="lg:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Link href="/">
          <a className="text-2xl font-serif font-bold tracking-widest uppercase cursor-pointer">
            Infinite Home
          </a>
        </Link>

        <nav className="hidden lg:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <a className={cn(
                "text-sm font-medium tracking-wide hover:opacity-70 transition-opacity uppercase",
                isScrolled || location !== "/" ? "text-foreground" : "text-white"
              )}>
                {link.name}
              </a>
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <button className="p-2 hover:opacity-70 transition-opacity">
            <Search size={20} />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:opacity-70 transition-opacity">
                <User size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-none">
              {isAuthenticated ? (
                <>
                  <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border mb-1">
                    Hi, {user?.name}
                  </div>
                  {user?.role === "admin" && (
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer gap-2">
                        <Shield size={14} /> Admin Panel
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem onClick={() => logout()} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                    <LogOut size={14} /> Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => login("customer@example.com", "user")} className="cursor-pointer">
                    Sign In
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => login("admin@infinitehome.mv", "admin")} className="cursor-pointer font-bold">
                    Admin Access
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 hover:opacity-70 transition-opacity relative">
                <ShoppingBag size={20} />
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                    {items.reduce((acc, item) => acc + (item.quantity || 0), 0)}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
              <SheetHeader className="p-6 border-b border-border text-left">
                <SheetTitle className="font-serif text-2xl">Shopping Bag</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <ShoppingBag size={48} className="text-muted-foreground opacity-20" />
                    <p className="text-muted-foreground">Your bag is currently empty.</p>
                    <Link href="/shop">
                      <Button variant="outline" className="rounded-none uppercase tracking-widest font-bold">Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-24 h-32 bg-secondary/20 shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-serif text-lg">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">{item.category}</p>
                          </div>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center border border-border">
                            <button 
                              onClick={() => updateQuantity(item.id, Math.max(1, (item.quantity || 1) - 1))}
                              className="p-1 hover:bg-secondary/50"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                              className="p-1 hover:bg-secondary/50"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="font-medium">{formatCurrency(item.price * (item.quantity || 0))}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <SheetFooter className="p-6 border-t border-border flex flex-col space-y-4">
                  <div className="flex justify-between items-center w-full">
                    <span className="uppercase tracking-widest font-bold text-sm">Subtotal</span>
                    <span className="text-xl font-medium">{formatCurrency(total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Shipping and taxes calculated at checkout.
                  </p>
                  <Link href="/checkout">
                    <Button className="w-full h-12 rounded-none uppercase tracking-widest font-bold">
                      Checkout
                    </Button>
                  </Link>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-background border-b border-border p-4 flex flex-col space-y-4 lg:hidden animate-in slide-in-from-top-5">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <a 
                className="text-foreground font-medium py-2 border-b border-border/50 uppercase text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            </Link>
          ))}
          <div className="pt-4 flex flex-col space-y-3">
             <Button className="w-full" variant="outline">Sign In</Button>
          </div>
        </div>
      )}
    </header>
  );
}
