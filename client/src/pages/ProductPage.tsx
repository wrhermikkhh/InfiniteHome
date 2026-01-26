import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { formatCurrency, ProductVariant, getVariantStock, getVariantStockKey, getDiscountPercentage } from "@/lib/products";
import { useProduct } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Star, Truck, ShieldCheck, RefreshCcw, Minus, Plus, Clock, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import { useCart } from "@/lib/cart";
import { motion } from "framer-motion";
import { getCertificationInfo } from "@/lib/certifications";

export default function ProductPage() {
  const [match, params] = useRoute("/product/:id");
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const { addItem } = useCart();

  const productId = params?.id || "";
  const { product, loading, error } = useProduct(productId);

  const [mainImage, setMainImage] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const allImages = product ? [product.image, ...(product.images || [])] : [];

  useEffect(() => {
    if (product?.image) {
      setMainImage(product.image);
      setCurrentImageIndex(0);
    }
  }, [product]);

  const goToImage = (index: number) => {
    if (allImages.length === 0) return;
    const newIndex = (index + allImages.length) % allImages.length;
    setCurrentImageIndex(newIndex);
    setMainImage(allImages[newIndex]);
  };

  const nextImage = () => goToImage(currentImageIndex + 1);
  const prevImage = () => goToImage(currentImageIndex - 1);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      nextImage();
    } else if (distance < -minSwipeDistance) {
      prevImage();
    }
  };

  const colors: string[] = product?.colors && product.colors.length > 0 ? product.colors : ["White"];
  const variants: ProductVariant[] = product?.variants && product.variants.length > 0 
    ? product.variants 
    : [{ size: "Standard", price: product?.price || 0 }];

  useEffect(() => {
    if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0]);
    if (variants.length > 0 && !selectedSize) setSelectedSize(variants[0].size);
  }, [colors, variants, selectedColor, selectedSize]);
  
  useEffect(() => {
    setQuantity(1);
  }, [selectedColor, selectedSize]);

  if (!match || !params) return <NotFound />;
  if (loading) return (
    <div className="min-h-screen bg-background font-body">
      <Navbar />
      <div className="pt-32 pb-16 container mx-auto px-4 text-center">
        <p className="text-muted-foreground uppercase tracking-widest text-sm animate-pulse">Loading product details...</p>
      </div>
      <Footer />
    </div>
  );
  if (error || !product) return <NotFound />;

  const currentVariant = variants.find(v => v.size === selectedSize) || variants[0];
  const currentPrice = currentVariant.price;
  const currentStock = product ? getVariantStock(product, selectedSize, selectedColor) : 0;
  const isOutOfStock = currentStock <= 0;
  
  const isPreOrder = product.isPreOrder || false;
  const preOrderPrice = product.preOrderPrice;
  const isOnSale = product.isOnSale || false;
  const salePrice = product.salePrice;
  const discountPercent = getDiscountPercentage(product);
  const preOrderInitialPayment = product.preOrderInitialPayment;
  const preOrderEta = product.preOrderEta;
  const displayPrice = isPreOrder && preOrderPrice 
    ? preOrderPrice 
    : (isOnSale && salePrice ? salePrice : currentPrice);

  return (
    <div className="min-h-screen bg-background font-body overflow-x-hidden">
      <Navbar />

      <div className="pt-32 pb-16 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Images */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <div 
              className="aspect-[4/5] bg-secondary/20 overflow-hidden w-full relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
               <motion.img 
                 key={mainImage}
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ duration: 0.5 }}
                 src={mainImage} 
                 alt={product.name} 
                 className="w-full h-full object-contain" 
               />
               
               {/* Navigation Arrows */}
               {allImages.length > 1 && (
                 <>
                   <button
                     onClick={prevImage}
                     className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background p-2 rounded-full shadow-lg transition-all"
                     aria-label="Previous image"
                     data-testid="button-prev-image"
                   >
                     <ChevronLeft size={24} />
                   </button>
                   <button
                     onClick={nextImage}
                     className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background p-2 rounded-full shadow-lg transition-all"
                     aria-label="Next image"
                     data-testid="button-next-image"
                   >
                     <ChevronRight size={24} />
                   </button>
                   
                   {/* Image Counter */}
                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 px-3 py-1 rounded-full text-sm">
                     {currentImageIndex + 1} / {allImages.length}
                   </div>
                 </>
               )}
            </div>
            
            {/* Gallery Thumbnails */}
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {allImages.map((img, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.1 }}
                    className={`aspect-square bg-secondary/20 overflow-hidden border-2 cursor-pointer transition-all ${currentImageIndex === idx ? 'border-primary' : 'border-transparent hover:border-primary/50'}`}
                    onClick={() => goToImage(idx)}
                    data-testid={`thumbnail-image-${idx}`}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-contain" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center space-x-2 mb-2"
              >
                 <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-current" />)}
                 </div>
                 <span className="text-sm text-muted-foreground underline">{product.reviews || 0} Reviews</span>
                 {isOutOfStock && (
                   <span className="text-xs font-bold uppercase tracking-widest text-destructive bg-destructive/10 px-2 py-1 ml-2">Out of Stock</span>
                 )}
                 {isPreOrder && (
                   <span className="text-xs font-bold uppercase tracking-widest bg-amber-500 text-white px-2 py-1 ml-2">Pre-Order</span>
                 )}
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-5xl font-serif mb-4 text-foreground leading-tight"
              >
                {product.name}
              </motion.h1>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3"
              >
                <p className="text-2xl font-medium text-foreground">
                  {formatCurrency(displayPrice)}
                </p>
                {isOnSale && salePrice && !isPreOrder && (
                  <>
                    <p className="text-xl text-muted-foreground line-through">
                      {formatCurrency(currentPrice)}
                    </p>
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-sm">
                      -{discountPercent}%
                    </span>
                  </>
                )}
              </motion.div>
            </div>

            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-muted-foreground text-lg leading-relaxed"
            >
              {product.description || "Experience the difference of our premium bamboo viscose fabric. Cooler than cotton, softer than silk."}
            </motion.p>

            {/* Certifications */}
            {product.certifications && product.certifications.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="flex flex-wrap items-center gap-4 mt-4"
              >
                {product.certifications.map((cert) => {
                  const certInfo = getCertificationInfo(cert);
                  return certInfo ? (
                    <a 
                      key={cert}
                      href={certInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center p-2 bg-white border border-gray-200 rounded hover:shadow-md transition-shadow"
                      title={certInfo.name}
                      data-testid={`certification-${cert.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <img 
                        src={certInfo.logo} 
                        alt={certInfo.name} 
                        className="h-10 w-auto object-contain"
                      />
                    </a>
                  ) : (
                    <span 
                      key={cert} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium border border-green-200"
                      data-testid={`certification-${cert.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <ShieldCheck size={12} />
                      {cert}
                    </span>
                  );
                })}
              </motion.div>
            )}

            {/* Configurator */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-6 pt-6 border-t border-border"
            >
              {/* Color */}
              <div className="space-y-3">
                <span className="text-sm font-bold uppercase tracking-widest">Color: <span className="text-muted-foreground font-normal normal-case">{selectedColor}</span></span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 text-sm border flex items-center gap-2 transition-all ${selectedColor === color ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
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
                 <div className="flex items-center justify-between">
                   <span className="text-sm font-bold uppercase tracking-widest">Size: <span className="text-muted-foreground font-normal normal-case">{selectedSize}</span></span>
                   <a href="/size-guide" className="text-sm text-primary hover:underline transition-colors" data-testid="link-size-guide">Size Guide</a>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {variants.map((v: ProductVariant) => (
                     <button
                       key={v.size}
                       onClick={() => setSelectedSize(v.size)}
                       className={`px-4 py-2 text-sm border transition-all ${selectedSize === v.size ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                       data-testid={`size-${v.size.toLowerCase()}`}
                     >
                       {v.size}
                     </button>
                   ))}
                 </div>
                 {(product.category?.toLowerCase().includes('mattress') || product.name?.toLowerCase().includes('mattress')) && (
                   <a href="/custom-mattress" className="inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-800 transition-colors" data-testid="link-custom-mattress">
                     <span>Can't find your size?</span>
                     <span className="underline font-medium">Get a custom mattress</span>
                   </a>
                 )}
              </div>

              {/* Pre-Order Info */}
              {isPreOrder && (
                <div className="bg-amber-50 border border-amber-200 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Package size={18} />
                    <span className="text-sm font-bold uppercase tracking-widest">Pre-Order Available</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Price</p>
                      <p className="font-bold text-lg">{formatCurrency(preOrderPrice || currentPrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Initial Payment</p>
                      <p className="font-bold text-lg">{formatCurrency(preOrderInitialPayment || 0)}</p>
                    </div>
                  </div>
                  {preOrderEta && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 pt-2 border-t border-amber-200">
                      <Clock size={14} />
                      <span>Estimated Arrival: <strong>{preOrderEta}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity & Add */}
              <div className="flex flex-col gap-4 pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className={`flex items-center border border-border w-fit ${!isPreOrder && currentStock <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={!isPreOrder && currentStock <= 0}
                      className="p-3 hover:bg-secondary/50 transition-colors"
                      data-testid="quantity-decrease"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-medium" data-testid="quantity-value">{quantity}</span>
                    <button 
                      onClick={() => (isPreOrder || currentStock > quantity) ? setQuantity(quantity + 1) : null}
                      disabled={!isPreOrder && (currentStock <= 0 || quantity >= currentStock)}
                      className="p-3 hover:bg-secondary/50 transition-colors"
                      data-testid="quantity-increase"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  {currentStock > 0 && (
                    <Button 
                      onClick={() => {
                        addItem(product, quantity, selectedColor, selectedSize, currentPrice);
                      }}
                      className="flex-1 h-12 rounded-none uppercase tracking-widest font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      data-testid="add-to-cart-instant"
                    >
                      Buy Instantly - {formatCurrency(currentPrice * quantity)}
                    </Button>
                  )}
                  
                  {isPreOrder && (
                    <Button 
                      onClick={() => {
                        addItem(product, quantity, selectedColor, selectedSize, preOrderInitialPayment || displayPrice, true, preOrderPrice || undefined, preOrderEta || undefined);
                      }}
                      className="flex-1 h-12 rounded-none uppercase tracking-widest font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-amber-600 text-white hover:bg-amber-700"
                      data-testid="add-to-cart-preorder"
                    >
                      Pre-Order - {formatCurrency((preOrderInitialPayment || displayPrice) * quantity)} deposit
                    </Button>
                  )}
                </div>
                
                {!isPreOrder && currentStock <= 0 && (
                  <Button disabled className="w-full h-12 rounded-none uppercase tracking-widest font-bold text-sm bg-secondary text-muted-foreground">
                    Out of Stock
                  </Button>
                )}
              </div>
            </motion.div>


            {/* Benefits */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-1 gap-4 pt-8 text-sm text-muted-foreground"
            >
               <div className="flex items-center space-x-3">
                 <Truck size={20} className="text-primary" />
                 <span>Free Delivery on all items</span>
               </div>
               <div className="flex items-start space-x-3">
                 <div className="pt-1"><Truck size={20} className="text-primary" /></div>
                 <div>
                   <p className="font-medium text-foreground">Express Delivery Available</p>
                   <p className="text-xs">MVR 15-100 (Male' & Hulhumale')</p>
                 </div>
               </div>
               <div className="flex items-center space-x-3">
                 <RefreshCcw size={20} className="text-primary" />
                 <span>Free Returns & Exchanges</span>
               </div>
            </motion.div>

          </motion.div>
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
