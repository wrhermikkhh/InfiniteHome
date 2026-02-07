import { Link } from "wouter";
import { Product, formatCurrency, getDiscountPercentage, getDisplayPrice, getProductVariants, getTotalVariantStock } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { Check } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const discountPercent = getDiscountPercentage(product);
  const variants = getProductVariants(product);
  const hasMultiplePrices = variants.length > 1 && variants.some(v => v.price !== variants[0].price);
  const lowestVariantPrice = hasMultiplePrices ? Math.min(...variants.map(v => v.price)) : null;
  const displayPrice = getDisplayPrice(product, lowestVariantPrice ?? undefined);
  const totalStock = getTotalVariantStock(product);
  const [justAdded, setJustAdded] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (totalStock > 0 || product.isPreOrder) {
      addItem(product);
      setJustAdded(true);
      
      const cartBtn = document.querySelector('[data-testid="button-cart"]');
      if (cartBtn) {
        cartBtn.classList.add('scale-125');
        setTimeout(() => cartBtn.classList.remove('scale-125'), 400);
      }
      
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  return (
    <div className="group block" data-testid={`card-product-${product.id}`}>
      <Link href={`/product/${product.id}`}>
        <motion.div 
          className="cursor-pointer block"
          whileHover={{ y: -4 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="relative aspect-square overflow-hidden bg-neutral-100 mb-4 rounded-sm">
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105 block"
            />
            
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {discountPercent && (
                <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-sm shadow-sm">
                  -{discountPercent}%
                </span>
              )}
              {product.isBestSeller && !discountPercent && (
                <span className="bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded-sm">
                  Best Seller
                </span>
              )}
              {product.isNew && !discountPercent && !product.isBestSeller && (
                <span className="bg-white text-foreground text-[11px] font-semibold px-2.5 py-1 border border-border/50 rounded-sm shadow-sm">
                  New
                </span>
              )}
              {product.isPreOrder && (
                <span className="bg-amber-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-sm">
                  Pre-Order
                </span>
              )}
            </div>

            <AnimatePresence>
              {justAdded && (
                <motion.div
                  className="absolute inset-0 bg-black/40 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="bg-white rounded-full p-3 shadow-xl"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <Check size={24} className="text-green-600" strokeWidth={3} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 w-full p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
               <Button 
                 onClick={handleQuickAdd}
                 disabled={totalStock <= 0 && !product.isPreOrder}
                 className="w-full rounded-sm h-10 text-xs tracking-wide font-semibold shadow-lg"
                 data-testid={`button-quick-add-${product.id}`}
               >
                 {justAdded ? "Added!" : (totalStock > 0 || product.isPreOrder ? "Quick Add" : "Out of Stock")}
               </Button>
            </div>
          </div>
          
          <div className="space-y-1.5 px-0.5">
            <h3 className="font-medium text-[15px] text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
              {product.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-semibold text-foreground">
                {hasMultiplePrices ? 'From ' : ''}{formatCurrency(displayPrice)}
              </p>
              {discountPercent && (
                <p className="text-sm text-muted-foreground line-through">
                  {hasMultiplePrices ? `From ${formatCurrency(lowestVariantPrice!)}` : formatCurrency(product.price)}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </div>
  );
}
