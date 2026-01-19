import { Link } from "wouter";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-secondary/30 pt-16 pb-8 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold tracking-widest uppercase">Infinite Home</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Luxury bedding, bath, and apparel made from the finest sustainable materials. Experience the softest fabrics on Earth.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-foreground hover:text-primary/70 transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-foreground hover:text-primary/70 transition-colors"><Facebook size={20} /></a>
              <a href="#" className="text-foreground hover:text-primary/70 transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-foreground hover:text-primary/70 transition-colors"><Youtube size={20} /></a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-sans font-bold text-sm uppercase tracking-wider mb-6">Shop</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/shop?category=Bedding"><a className="hover:text-foreground transition-colors">Bedding</a></Link></li>
              <li><Link href="/shop?category=Bath"><a className="hover:text-foreground transition-colors">Bath</a></Link></li>
              <li><Link href="/shop?category=Apparel"><a className="hover:text-foreground transition-colors">Apparel</a></Link></li>
              <li><Link href="/shop?category=Accessories"><a className="hover:text-foreground transition-colors">Accessories</a></Link></li>
              <li><Link href="/shop?category=Sale"><a className="hover:text-foreground transition-colors">Sale</a></Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-sans font-bold text-sm uppercase tracking-wider mb-6">Support</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/track"><a className="hover:text-foreground transition-colors">Track Order</a></Link></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Returns & Exchanges</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Shipping Info</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Warranty</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-sans font-bold text-sm uppercase tracking-wider mb-6">Join Our Family</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Subscribe to receive updates, access to exclusive deals, and more.
            </p>
            <form className="flex gap-2">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1 bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button className="bg-primary text-primary-foreground px-4 py-2 text-xs uppercase font-bold tracking-wider hover:opacity-90 transition-opacity">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Infinite Home. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms of Service</a>
            <a href="#" className="hover:text-foreground">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
