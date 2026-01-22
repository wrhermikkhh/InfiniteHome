import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ui/product-card";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api, type Category } from "@/lib/api";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function Shop() {
  const [location] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const category = params.get("category");
  const { products, loading } = useProducts();

  const { data: dynamicCategories = [], refetch } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  useEffect(() => {
    const handleUpdate = () => refetch();
    window.addEventListener('category-updated', handleUpdate);
    return () => window.removeEventListener('category-updated', handleUpdate);
  }, [refetch]);

  const categories = ["Shop All", ...dynamicCategories.map(c => c.name)];

  const filteredProducts = category && category !== "Shop All" && category !== "Sale"
    ? products.filter(p => p.category.toLowerCase() === category.toLowerCase())
    : products;

  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <Navbar />
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-secondary/30 pt-32 pb-16"
      >
        <div className="container mx-auto px-4 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-5xl font-serif mb-4"
          >
            {category || "Shop All"}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-muted-foreground max-w-lg mx-auto"
          >
            Discover premium home essentials - from luxury bedding to modern furniture and appliances.
          </motion.p>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-12">
        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap gap-4 justify-center mb-12"
        >
          {categories.map(cat => (
            <Link key={cat} href={cat === "Shop All" ? "/shop" : `/shop?category=${cat}`}>
              <Button 
                variant={category === cat || (!category && cat === "Shop All") ? "default" : "outline"}
                className={cn(
                  "rounded-full px-6",
                  category === cat || (!category && cat === "Shop All") 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-transparent border-border hover:bg-secondary/50"
                )}
              >
                {cat}
              </Button>
            </Link>
          ))}
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-24 text-muted-foreground uppercase tracking-widest text-sm animate-pulse">Loading collection...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, delay: (index % 4) * 0.1 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <h3 className="text-2xl font-serif text-muted-foreground">No products found in this category.</h3>
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  const [_, setLocation] = useLocation();
  return (
    <div onClick={() => setLocation(href)} className="inline-block cursor-pointer">
      {children}
    </div>
  )
}
