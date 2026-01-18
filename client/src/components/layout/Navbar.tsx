import { Link, useLocation } from "wouter";
import { Search, ShoppingBag, User, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

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
    { name: "Sale", href: "/shop?category=Sale" },
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
        {/* Mobile Menu Button */}
        <button 
          className="lg:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Logo */}
        <Link href="/">
          <a className="text-2xl font-serif font-bold tracking-widest uppercase cursor-pointer">
            Infinite Home
          </a>
        </Link>

        {/* Desktop Nav */}
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

        {/* Actions */}
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:opacity-70 transition-opacity">
            <Search size={20} />
          </button>
          <button className="hidden sm:block p-2 hover:opacity-70 transition-opacity">
            <User size={20} />
          </button>
          <button className="p-2 hover:opacity-70 transition-opacity relative">
            <ShoppingBag size={20} />
            <span className="absolute top-0 right-0 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
              2
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
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
