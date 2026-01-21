import { Link, useLocation } from "wouter";
import { Search, ShoppingBag, User, Menu, X, Trash2, Plus, Minus, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatCurrency, type Product } from "@/lib/products";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [location, setLocation] = useLocation();
  const cart = useCart();
  const { user, logout, isAuthenticated } = useAuth();
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

  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await api.searchProducts(searchQuery);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      }
      setIsSearching(false);
    };
    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const navLinks = [
    { name: "Shop All", href: "/shop" },
    { name: "Bedding", href: "/shop?category=Bedding" },
    { name: "Furniture", href: "/shop?category=Furniture" },
    { name: "Appliances", href: "/shop?category=Appliances" },
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

        <Link 
          href="/"
          className="text-xl md:text-2xl font-serif font-bold tracking-widest uppercase cursor-pointer whitespace-nowrap"
        >
          INFINITE HOME
        </Link>

        <nav className="hidden lg:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={cn(
                "text-sm font-medium tracking-wide hover:opacity-70 transition-opacity uppercase",
                isScrolled || location !== "/" ? "text-foreground" : "text-white"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <button 
            className="p-2 hover:opacity-70 transition-opacity"
            onClick={() => setSearchOpen(true)}
            data-testid="button-search"
          >
            <Search size={20} />
          </button>

          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent className="sm:max-w-lg rounded-none p-0">
              <DialogHeader className="p-4 border-b border-border">
                <DialogTitle className="font-serif text-xl">Search Products</DialogTitle>
              </DialogHeader>
              <div className="p-4">
                <Input
                  placeholder="Search for products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-none h-12"
                  autoFocus
                  data-testid="input-search"
                />
              </div>
              <div className="max-h-80 overflow-y-auto">
                {isSearching && (
                  <div className="p-4 text-center text-muted-foreground">Searching...</div>
                )}
                {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">No products found</div>
                )}
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors border-b border-border last:border-0 text-left"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      setSearchResults([]);
                      setLocation(`/product/${product.id}`);
                    }}
                    data-testid={`search-result-${product.id}`}
                  >
                    <div className="w-16 h-16 bg-secondary/30 flex-shrink-0">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{product.name}</h4>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                      <p className="text-sm font-bold mt-1">{formatCurrency(product.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:opacity-70 transition-opacity" data-testid="button-user-menu">
                <User size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-none">
              {isAuthenticated ? (
                <>
                  <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border mb-1">
                    Hi, {user?.name}
                  </div>
                  <Link href="/account">
                    <DropdownMenuItem className="cursor-pointer gap-2" data-testid="menu-item-account">
                      <User size={14} /> My Account
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/track">
                    <DropdownMenuItem className="cursor-pointer gap-2" data-testid="menu-item-track">
                      Track Order
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    onClick={() => logout()} 
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    data-testid="menu-item-logout"
                  >
                    <LogOut size={14} /> Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-login">
                      Sign In
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/signup">
                    <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-signup">
                      Create Account
                    </DropdownMenuItem>
                  </Link>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 hover:opacity-70 transition-opacity relative" data-testid="button-cart">
                <ShoppingBag size={20} />
                {items.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center">
                    {items.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg flex flex-col">
              <SheetHeader className="border-b border-border pb-4">
                <SheetTitle className="font-serif text-xl">Shopping Bag ({items.length})</SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto py-4">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <ShoppingBag size={48} className="mb-4 opacity-50" />
                    <p className="text-sm uppercase tracking-widest">Your bag is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id + (item.selectedColor || '') + (item.selectedSize || '')} className="flex gap-4 pb-4 border-b border-border">
                        <div className="w-24 h-24 bg-secondary/30 flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.selectedColor && <span>{item.selectedColor}</span>}
                            {item.selectedColor && item.selectedSize && <span> / </span>}
                            {item.selectedSize && <span>{item.selectedSize}</span>}
                          </p>
                          <p className="text-sm font-bold mt-2">{formatCurrency(item.price)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button 
                              onClick={() => updateQuantity(item.id, (item.quantity || 0) - 1)}
                              className="p-1 border border-border hover:bg-secondary/50"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs w-6 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, (item.quantity || 0) + 1)}
                              className="p-1 border border-border hover:bg-secondary/50"
                            >
                              <Plus size={12} />
                            </button>
                            <button 
                              onClick={() => removeItem(item.id)}
                              className="ml-auto p-1 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {items.length > 0 && (
                <SheetFooter className="border-t border-border pt-4 block">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm uppercase tracking-widest font-bold">Subtotal</span>
                    <span className="text-lg font-bold">{formatCurrency(total)}</span>
                  </div>
                  <Button 
                    className="w-full h-12 rounded-none text-xs uppercase tracking-widest font-bold"
                    onClick={() => setLocation("/checkout")}
                    data-testid="button-checkout"
                  >
                    Checkout
                  </Button>
                </SheetFooter>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-background border-b border-border p-4 flex flex-col space-y-4 lg:hidden animate-in slide-in-from-top-5">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className="text-foreground font-medium py-2 border-b border-border/50 uppercase text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-4 flex flex-col space-y-3">
            {isAuthenticated ? (
              <>
                <Button 
                  className="w-full rounded-none" 
                  variant="outline"
                  onClick={() => { setMobileMenuOpen(false); setLocation("/account"); }}
                >
                  My Account
                </Button>
                <Button 
                  className="w-full rounded-none" 
                  variant="ghost"
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button 
                  className="w-full rounded-none" 
                  variant="outline"
                  onClick={() => { setMobileMenuOpen(false); setLocation("/login"); }}
                >
                  Sign In
                </Button>
                <Button 
                  className="w-full rounded-none"
                  onClick={() => { setMobileMenuOpen(false); setLocation("/signup"); }}
                >
                  Create Account
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
