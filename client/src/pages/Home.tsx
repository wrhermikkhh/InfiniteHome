import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ui/product-card";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";
import beddingImage from "@assets/generated_images/stack_of_folded_premium_white_bedding.png";
import furnitureImage from "@assets/generated_images/minimalist_luxury_furniture_in_bright_room.png";
import appliancesImage from "@assets/generated_images/elegant_high-end_kitchen_appliances_in_modern_home.png";

export default function Home() {
  const { products, loading } = useProducts();
  const bestSellers = products.filter(p => p.isBestSeller);

  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
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
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-serif mb-4 text-foreground">Shop by Category</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Discover our curated collection of premium home essentials tailored for your lifestyle.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <Link href="/shop?category=Bedding">
                <div className="group cursor-pointer space-y-4">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <img 
                      src={beddingImage} 
                      alt="Bedding" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground">Bedding</h3>
                    <ArrowRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Link href="/shop?category=Furniture">
                <div className="group cursor-pointer space-y-4">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <img 
                      src={furnitureImage} 
                      alt="Furniture" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground">Furniture</h3>
                    <ArrowRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Link href="/shop?category=Appliances">
                <div className="group cursor-pointer space-y-4">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <img 
                      src={appliancesImage} 
                      alt="Appliances" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-foreground">Appliances</h3>
                    <ArrowRight size={18} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex justify-between items-end mb-12"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-serif mb-2">Best Sellers</h2>
              <p className="text-muted-foreground">Our most loved products.</p>
            </div>
            <Link href="/shop">
              <Button variant="link" className="text-foreground hover:no-underline p-0 group">
                View All <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {loading ? (
              <div className="col-span-4 text-center py-12 text-muted-foreground">Loading products...</div>
            ) : (
              products.slice(0, 4).map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
