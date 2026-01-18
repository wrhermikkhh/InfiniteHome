import { Link } from "wouter";
import { Product, formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/product/${product.id}`}>
      <motion.div 
        className="group cursor-pointer block"
        whileHover={{ y: -5 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-secondary/20 mb-4">
          <img 
            src={product.image} 
            alt={product.name}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
          />
          {product.isBestSeller && (
            <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1">
              Best Seller
            </span>
          )}
          {product.isNew && (
            <span className="absolute top-2 left-2 bg-white text-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-border">
              New
            </span>
          )}
          <div className="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
             <Button className="w-full rounded-none uppercase text-xs tracking-widest font-bold">
               Quick Add
             </Button>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={12} 
                  className={i < Math.floor(product.rating) ? "fill-primary text-primary" : "text-muted-foreground"} 
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
          </div>
          <h3 className="font-serif text-lg text-foreground group-hover:underline decoration-1 underline-offset-4 decoration-muted-foreground/50">
            {product.name}
          </h3>
          <p className="text-sm font-medium text-foreground/80">
            {formatCurrency(product.price)}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
