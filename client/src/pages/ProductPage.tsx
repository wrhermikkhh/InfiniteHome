import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { formatCurrency, ProductVariant } from "@/lib/products";
import { useProduct } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Star, Truck, ShieldCheck, RefreshCcw, Minus, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import { useCart } from "@/lib/cart";

export default function ProductPage() {
  const [match, params] = useRoute("/product/:id");
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const { addItem } = useCart();

  const productId = params?.id || "";
  const { product, loading, error } = useProduct(productId);

  const colors: string[] = product?.colors && product.colors.length > 0 ? product.colors : ["White"];
  const variants: ProductVariant[] = product?.variants && product.variants.length > 0 
    ? product.variants 
    : [{ size: "Standard", price: product?.price || 0 }];

  useEffect(() => {
    if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0]);
    if (variants.length > 0 && !selectedSize) setSelectedSize(variants[0].size);
  }, [colors, variants, selectedColor, selectedSize]);

  if (!match || !params) return <NotFound />;
  if (loading) return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      <div className="pt-32 pb-16 container mx-auto px-4 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
      <Footer />
    </div>
  );
  if (error || !product) return <NotFound />;

  const currentVariant = variants.find(v => v.size === selectedSize) || variants[0];
  const currentPrice = currentVariant.price;

  return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />

      <div className="pt-32 pb-16 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-[4/5] bg-secondary/20 overflow-hidden w-full">
               <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>
            
            {/* Gallery Images */}
            {product.images && product.images.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                <div className="aspect-square bg-secondary/20 overflow-hidden border-2 border-primary cursor-pointer">
                  <img src={product.image} alt={`${product.name} main`} className="w-full h-full object-cover" />
                </div>
                {product.images.map((img, idx) => (
                  <div key={idx} className="aspect-square bg-secondary/20 overflow-hidden border border-transparent hover:border-primary/50 cursor-pointer transition-colors">
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                 <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-current" />)}
                 </div>
                 <span className="text-sm text-muted-foreground underline">{product.reviews || 0} Reviews</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif mb-4 text-foreground leading-tight">{product.name}</h1>
              <p className="text-2xl font-medium text-foreground">{formatCurrency(currentPrice)}</p>
            </div>

            <p className="text-muted-foreground text-lg leading-relaxed">
              {product.description || "Experience the difference of our premium bamboo viscose fabric. Cooler than cotton, softer than silk."}
            </p>

            {/* Configurator */}
            <div className="space-y-6 pt-6 border-t border-border">
              {/* Color */}
              <div className="space-y-3">
                <span className="text-sm font-bold uppercase tracking-widest">Color: <span className="text-muted-foreground font-normal normal-case">{selectedColor}</span></span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 text-sm border flex items-center gap-2 ${selectedColor === color ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                      data-testid={`color-${color.toLowerCase()}`}
                    >
                      <div className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: getColorCode(color) }}></div>
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className="space-y-3">
                 <span className="text-sm font-bold uppercase tracking-widest">Size: <span className="text-muted-foreground font-normal normal-case">{selectedSize}</span></span>
                 <div className="flex flex-wrap gap-2">
                   {variants.map((v: ProductVariant) => (
                     <button
                       key={v.size}
                       onClick={() => setSelectedSize(v.size)}
                       className={`px-4 py-2 text-sm border ${selectedSize === v.size ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                       data-testid={`size-${v.size.toLowerCase()}`}
                     >
                       {v.size}
                     </button>
                   ))}
                 </div>
              </div>

              {/* Quantity & Add */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <div className="flex items-center border border-border w-fit">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:bg-secondary/50 transition-colors"
                    data-testid="quantity-decrease"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-medium" data-testid="quantity-value">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 hover:bg-secondary/50 transition-colors"
                    data-testid="quantity-increase"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <Button 
                  onClick={() => addItem(product, quantity, selectedColor, selectedSize, currentPrice)}
                  className="flex-1 h-12 rounded-none uppercase tracking-widest font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="add-to-cart"
                >
                  Add to Bag - {formatCurrency(currentPrice * quantity)}
                </Button>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 gap-4 pt-8 text-sm text-muted-foreground">
               <div className="flex items-center space-x-3">
                 <Truck size={20} className="text-primary" />
                 <span>Free Shipping on orders over MVR 1500</span>
               </div>
               <div className="flex items-center space-x-3">
                 <ShieldCheck size={20} className="text-primary" />
                 <span>10-Year Warranty & 100-Night Sleep Trial</span>
               </div>
               <div className="flex items-center space-x-3">
                 <RefreshCcw size={20} className="text-primary" />
                 <span>Free Returns & Exchanges</span>
               </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function getColorCode(name: string) {
  switch(name) {
    case "White": return "#ffffff";
    case "Oat": return "#eaddcf";
    case "Charcoal": return "#36454F";
    case "Driftwood": return "#8b8178";
    case "Olive": return "#708238";
    case "Sand": return "#c2b280";
    case "Slate": return "#708090";
    case "Champagne": return "#f7e7ce";
    case "Navy": return "#1e3a5f";
    case "Emerald": return "#2e8b57";
    case "Blush": return "#de98ab";
    case "Natural Oak": return "#c8a876";
    case "Walnut": return "#5d432c";
    case "Beige": return "#f5f5dc";
    case "Gray": return "#808080";
    case "Black": return "#1a1a1a";
    case "Red": return "#b91c1c";
    case "Silver": return "#c0c0c0";
    case "Ivory": return "#fffff0";
    default: return "#eeeeee";
  }
}
