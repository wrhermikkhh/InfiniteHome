import { Link } from "wouter";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-secondary/30 pt-16 pb-8 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="font-serif text-xl font-bold tracking-widest uppercase whitespace-nowrap">INFINITE HOME</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
              Premium home essentials including luxury bedding, furniture, and appliances. Transform your living space with our curated collection.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="https://instagram.com/infinitehome" className="text-foreground hover:text-primary/70 transition-colors"><Instagram size={20} /></a>
              <a href="https://facebook.com/infinitehome" className="text-foreground hover:text-primary/70 transition-colors"><Facebook size={20} /></a>
              <a href="https://twitter.com/infinitehome" className="text-foreground hover:text-primary/70 transition-colors"><Twitter size={20} /></a>
              <a href="https://youtube.com/infinitehome" className="text-foreground hover:text-primary/70 transition-colors"><Youtube size={20} /></a>
            </div>
            <div className="pt-2 text-sm text-muted-foreground">
              <p>Email: info@infinitehome.mv</p>
              <p>Phone: 7840001</p>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-sans font-bold text-sm uppercase tracking-wider mb-6">Shop</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/shop?category=Bedding" className="hover:text-foreground transition-colors">Bedding</Link></li>
              <li><Link href="/shop?category=Furniture" className="hover:text-foreground transition-colors">Furniture</Link></li>
              <li><Link href="/shop?category=Appliances" className="hover:text-foreground transition-colors">Appliances</Link></li>
              <li><Link href="/shop" className="hover:text-foreground transition-colors">All Products</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-sans font-bold text-sm uppercase tracking-wider mb-6">Support</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/track" className="hover:text-foreground transition-colors">Track Order</Link></li>
              <li><Link href="/returns" className="hover:text-foreground transition-colors">Returns & Exchanges</Link></li>
              <li><Link href="/shipping" className="hover:text-foreground transition-colors">Shipping Info</Link></li>
              <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
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
          <p>&copy; {new Date().getFullYear()} INFINITE LOOP PVT LTD. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/returns" className="hover:text-foreground">Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
