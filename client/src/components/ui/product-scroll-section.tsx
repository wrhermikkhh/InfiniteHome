import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import { Button } from "./button";
import { Link } from "wouter";
import { motion } from "framer-motion";

interface ProductScrollSectionProps {
  title: string;
  products: Product[];
  viewAllLink?: string;
  loading?: boolean;
}

export function ProductScrollSection({ title, products, viewAllLink, loading }: ProductScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-foreground">{title}</h2>
          <div className="flex items-center gap-3">
            {viewAllLink && (
              <Link href={viewAllLink}>
                <Button variant="link" className="text-sm font-medium text-foreground hover:text-primary p-0 h-auto" data-testid={`link-view-all-${title.toLowerCase().replace(/\s/g, '-')}`}>
                  View All
                </Button>
              </Link>
            )}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => scroll("left")}
                className="p-2 rounded-full border border-border hover:bg-secondary/50 transition-colors"
                aria-label="Scroll left"
                data-testid={`button-scroll-left-${title.toLowerCase().replace(/\s/g, '-')}`}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scroll("right")}
                className="p-2 rounded-full border border-border hover:bg-secondary/50 transition-colors"
                aria-label="Scroll right"
                data-testid={`button-scroll-right-${title.toLowerCase().replace(/\s/g, '-')}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="relative -mx-4 px-4">
          <div
            ref={scrollRef}
            className="flex gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[220px] md:w-[280px] snap-start">
                  <div className="aspect-square bg-secondary/30 animate-pulse rounded-sm mb-4" />
                  <div className="h-4 bg-secondary/30 animate-pulse rounded w-3/4 mb-2" />
                  <div className="h-4 bg-secondary/30 animate-pulse rounded w-1/2" />
                </div>
              ))
            ) : (
              products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex-shrink-0 w-[220px] md:w-[280px] snap-start"
                >
                  <ProductCard product={product} />
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
