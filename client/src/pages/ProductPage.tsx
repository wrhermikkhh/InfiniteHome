import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { products, formatCurrency } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Star, Truck, ShieldCheck, RefreshCcw, Minus, Plus } from "lucide-react";
import { useState } from "react";
import NotFound from "@/pages/not-found";

export default function ProductPage() {
  const [match, params] = useRoute("/product/:id");
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("White");
  const [selectedSize, setSelectedSize] = useState("Queen");

  if (!match || !params) return <NotFound />;

  const product = products.find(p => p.id === params.id);
  if (!product) return <NotFound />;

  const colors = ["White", "Oat", "Charcoal", "Driftwood", "Olive"];
  const sizes = ["Twin", "Full", "Queen", "King", "Cali King"];

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
            <div className="grid grid-cols-2 gap-4">
               <div className="aspect-square bg-secondary/20 overflow-hidden">
                 <img src={product.image} alt="Detail 1" className="w-full h-full object-cover" />
               </div>
               <div className="aspect-square bg-secondary/20 overflow-hidden">
                 <img src={product.image} alt="Detail 2" className="w-full h-full object-cover scale-150" />
               </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                 <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-current" />)}
                 </div>
                 <span className="text-sm text-muted-foreground underline">{product.reviews} Reviews</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif mb-4 text-foreground leading-tight">{product.name}</h1>
              <p className="text-2xl font-medium text-foreground">{formatCurrency(product.price)}</p>
            </div>

            <p className="text-muted-foreground text-lg leading-relaxed">
              {product.description} Experience the difference of our premium bamboo viscose fabric. Cooler than cotton, softer than silk.
            </p>

            {/* Configurator */}
            <div className="space-y-6 pt-6 border-t border-border">
              {/* Color */}
              <div className="space-y-3">
                <span className="text-sm font-bold uppercase tracking-widest">Color: <span className="text-muted-foreground font-normal normal-case">{selectedColor}</span></span>
                <div className="flex flex-wrap gap-3">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${selectedColor === color ? 'border-primary ring-1 ring-offset-2 ring-primary' : 'border-transparent hover:border-border'}`}
                    >
                      <div className={`w-8 h-8 rounded-full border border-black/10`} style={{ backgroundColor: getColorCode(color) }}></div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className="space-y-3">
                 <span className="text-sm font-bold uppercase tracking-widest">Size: <span className="text-muted-foreground font-normal normal-case">{selectedSize}</span></span>
                 <div className="flex flex-wrap gap-2">
                   {sizes.map(size => (
                     <button
                       key={size}
                       onClick={() => setSelectedSize(size)}
                       className={`px-4 py-2 text-sm border ${selectedSize === size ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                     >
                       {size}
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
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 hover:bg-secondary/50 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <Button className="flex-1 h-12 rounded-none uppercase tracking-widest font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                  Add to Bag - {formatCurrency(product.price * quantity)}
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
    default: return "#eeeeee";
  }
}
