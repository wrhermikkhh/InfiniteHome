import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ui/product-card";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { ArrowRight, Video, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";
import beddingImage from "@assets/generated_images/stack_of_folded_premium_white_bedding.png";
import furnitureImage from "@assets/generated_images/plush_white_towels_in_spa_bathroom.png";
import appliancesImage from "@assets/generated_images/woman_in_beige_loungewear_reading.png";

export default function Home() {
  const { products, loading } = useProducts();
  const bestSellers = products.filter(p => p.isBestSeller);

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-[90vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Luxury Bedroom" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        
        <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-center text-center text-white space-y-6">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="uppercase tracking-[0.2em] text-sm font-medium"
          >
            The World's Softest Bedding
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif font-medium leading-tight"
          >
            Sleep Like <br/> Never Before
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="pt-4"
          >
            <Link href="/shop">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-none h-14 px-10 text-xs uppercase tracking-widest font-bold">
                Shop Bedding
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      
      {/* Categories */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif mb-4 text-foreground">Shop by Category</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Discover our curated collection of premium home essentials tailored for your lifestyle.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link href="/shop?category=Bedding">
              <div className="group cursor-pointer space-y-4">
                <div className="aspect-[4/5] overflow-hidden relative">
                  <img src={beddingImage} alt="Bedding" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                </div>
                <div className="text-center">
                  <h3 className="font-serif text-2xl mb-1 group-hover:text-primary/80 transition-colors">Bedding</h3>
                  <span className="text-xs font-bold uppercase tracking-widest border-b border-transparent group-hover:border-foreground transition-all">Shop Now</span>
                </div>
              </div>
            </Link>
            
            <Link href="/shop?category=Furniture">
              <div className="group cursor-pointer space-y-4">
                <div className="aspect-[4/5] overflow-hidden relative bg-secondary/30 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🛋️</div>
                    <p className="text-muted-foreground text-sm">Premium Furniture</p>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-serif text-2xl mb-1 group-hover:text-primary/80 transition-colors">Furniture</h3>
                  <span className="text-xs font-bold uppercase tracking-widest border-b border-transparent group-hover:border-foreground transition-all">Shop Now</span>
                </div>
              </div>
            </Link>
            
            <Link href="/shop?category=Appliances">
              <div className="group cursor-pointer space-y-4">
                <div className="aspect-[4/5] overflow-hidden relative bg-secondary/30 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🏠</div>
                    <p className="text-muted-foreground text-sm">Home Appliances</p>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-serif text-2xl mb-1 group-hover:text-primary/80 transition-colors">Appliances</h3>
                  <span className="text-xs font-bold uppercase tracking-widest border-b border-transparent group-hover:border-foreground transition-all">Shop Now</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif mb-2">Best Sellers</h2>
              <p className="text-muted-foreground">Our most loved products.</p>
            </div>
            <Link href="/shop">
              <Button variant="link" className="text-foreground hover:no-underline p-0 group">
                View All <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading ? (
              <div className="col-span-4 text-center py-12 text-muted-foreground">Loading products...</div>
            ) : (
              products.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Video Call Promo */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
             <div className="inline-flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
               <Video size={14} />
               <span>Infinite Home Live</span>
             </div>
             <h2 className="text-4xl md:text-5xl font-serif leading-tight">
               Experience Infinite Home <br/> From Your Home.
             </h2>
             <p className="text-primary-foreground/80 text-lg max-w-md">
               Book a complimentary virtual consultation with our design experts. See the fabrics, compare colors, and get personalized styling advice via video call.
             </p>
             <div className="pt-4">
               <Link href="/consultation">
                 <Button className="bg-white text-primary hover:bg-white/90 rounded-none h-14 px-8 text-xs uppercase tracking-widest font-bold">
                   Book Consultation
                 </Button>
               </Link>
             </div>
          </div>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
             <img src={appliancesImage} alt="Video Call Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
             <div className="relative z-10 bg-white/10 backdrop-blur-md p-6 rounded-lg text-center border border-white/20">
               <p className="font-serif text-xl mb-2">Next Available Slot</p>
               <p className="text-2xl font-bold">Today, 3:00 PM</p>
               <p className="text-xs uppercase tracking-widest mt-2 opacity-80">Maldives Time</p>
             </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
