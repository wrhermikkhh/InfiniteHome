import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { ProductScrollSection } from "@/components/ui/product-scroll-section";
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
  
  const saleProducts = products.filter(p => p.isOnSale);
  const beddingProducts = products.filter(p => p.category === "Bedding");
  const furnitureProducts = products.filter(p => p.category === "Furniture");
  const applianceProducts = products.filter(p => p.category === "Appliances");
  const newArrivals = products.filter(p => p.isNew);

  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <AnnouncementBar />
      <Navbar />
      
      <section className="relative h-[85vh] md:h-[90vh] w-full overflow-hidden mt-14">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Luxury Bedroom" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>
        
        <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-16 md:pb-24 text-white">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <span className="text-xs md:text-sm uppercase tracking-[0.2em] font-medium text-white/90 mb-4 block">
              Premium Home Essentials
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-medium leading-[1.1] mb-6">
              Transform Your <br/>Living Space
            </h1>
            <p className="text-base md:text-lg text-white/80 mb-8 max-w-md">
              Discover our curated collection of luxury bedding, furniture, and appliances for your home.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/shop">
                <Button 
                  size="lg" 
                  className="bg-white text-black hover:bg-white/90 rounded-sm h-12 px-8 text-sm font-semibold tracking-wide"
                  data-testid="button-shop-now"
                >
                  Shop Now
                </Button>
              </Link>
              <Link href="/shop?category=Bedding">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white text-white hover:bg-white/10 rounded-sm h-12 px-8 text-sm font-semibold tracking-wide bg-transparent"
                  data-testid="button-shop-bedding"
                >
                  Explore Bedding
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {saleProducts.length > 0 && (
        <div className="bg-red-50/50">
          <ProductScrollSection
            title="Sale"
            products={saleProducts}
            viewAllLink="/shop?sale=true"
            loading={loading}
          />
        </div>
      )}

      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-serif font-medium mb-3">Shop by Category</h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
              Discover our curated collection of premium home essentials
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { name: "Bedding", image: beddingImage, link: "/shop?category=Bedding" },
              { name: "Furniture", image: furnitureImage, link: "/shop?category=Furniture" },
              { name: "Appliances", image: appliancesImage, link: "/shop?category=Appliances" },
            ].map((category, index) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link href={category.link}>
                  <div className="group cursor-pointer relative overflow-hidden rounded-sm" data-testid={`card-category-${category.name.toLowerCase()}`}>
                    <div className="aspect-[4/5] overflow-hidden">
                      <img 
                        src={category.image} 
                        alt={category.name} 
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-white font-serif text-2xl md:text-3xl mb-2">{category.name}</h3>
                      <span className="inline-flex items-center text-white/90 text-sm font-medium group-hover:gap-2 transition-all">
                        Shop Now <ArrowRight size={16} className="ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {beddingProducts.length > 0 && (
        <ProductScrollSection
          title="Bedding"
          products={beddingProducts}
          viewAllLink="/shop?category=Bedding"
          loading={loading}
        />
      )}

      {furnitureProducts.length > 0 && (
        <div className="bg-secondary/30">
          <ProductScrollSection
            title="Furniture"
            products={furnitureProducts}
            viewAllLink="/shop?category=Furniture"
            loading={loading}
          />
        </div>
      )}

      {applianceProducts.length > 0 && (
        <ProductScrollSection
          title="Appliances"
          products={applianceProducts}
          viewAllLink="/shop?category=Appliances"
          loading={loading}
        />
      )}

      {newArrivals.length > 0 && (
        <div className="bg-secondary/30">
          <ProductScrollSection
            title="New Arrivals"
            products={newArrivals}
            viewAllLink="/shop?new=true"
            loading={loading}
          />
        </div>
      )}

      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">Why Choose Us</h2>
            <p className="text-primary-foreground/80 mb-10">
              Premium quality products with exceptional customer service
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { title: "Free Delivery", desc: "On all orders throughout Maldives" },
              { title: "30-Day Returns", desc: "Free returns and exchanges" },
              { title: "Premium Quality", desc: "Certified and trusted products" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center"
              >
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-primary-foreground/70 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
