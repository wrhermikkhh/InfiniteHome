import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ui/product-card";
import { products } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import heroImage from "@assets/generated_images/luxury_bright_bedroom_with_white_bamboo_sheets.png";

export default function Shop() {
  const [location] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const category = params.get("category");

  const filteredProducts = category && category !== "Shop All" && category !== "Sale"
    ? products.filter(p => p.category === category)
    : products;

  const categories = ["Shop All", "Bedding", "Bath", "Apparel", "Sale"];

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      
      {/* Header */}
      <div className="bg-secondary/30 pt-32 pb-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif mb-4">{category || "Shop All"}</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Discover the pinnacle of comfort with our sustainable bamboo collection.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
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
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-24">
            <h3 className="text-2xl font-serif text-muted-foreground">No products found in this category.</h3>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// Helper Link component since wouter link doesn't accept all props directly nicely sometimes
function Link({ href, children }: { href: string; children: React.ReactNode }) {
  const [_, setLocation] = useLocation();
  return (
    <div onClick={() => setLocation(href)} className="inline-block cursor-pointer">
      {children}
    </div>
  )
}
