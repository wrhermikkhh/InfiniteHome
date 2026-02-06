import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ShoppingBag } from "lucide-react";

interface FlyingItem {
  id: number;
  x: number;
  y: number;
  image: string;
}

let flyId = 0;

export function useCartAnimation() {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [cartBounce, setCartBounce] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const triggerAnimation = useCallback((e: React.MouseEvent, imageUrl: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = ++flyId;
    setFlyingItems(prev => [...prev, {
      id,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      image: imageUrl,
    }]);

    setTimeout(() => {
      setCartBounce(true);
      setShowConfirmation(true);
      setTimeout(() => setCartBounce(false), 600);
      setTimeout(() => setShowConfirmation(false), 2000);
    }, 500);

    setTimeout(() => {
      setFlyingItems(prev => prev.filter(item => item.id !== id));
    }, 700);
  }, []);

  return { flyingItems, cartBounce, showConfirmation, triggerAnimation };
}

export function FlyingItems({ items }: { items: FlyingItem[] }) {
  const cartButton = document.querySelector('[data-testid="button-cart"]');
  const cartRect = cartButton?.getBoundingClientRect();
  const targetX = cartRect ? cartRect.left + cartRect.width / 2 : window.innerWidth - 40;
  const targetY = cartRect ? cartRect.top + cartRect.height / 2 : 20;

  return (
    <AnimatePresence>
      {items.map(item => (
        <motion.div
          key={item.id}
          className="fixed z-[9999] pointer-events-none"
          initial={{
            x: item.x - 28,
            y: item.y - 28,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: targetX - 28,
            y: targetY - 28,
            scale: 0.15,
            opacity: 0.6,
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            duration: 0.55,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        >
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary shadow-xl bg-white">
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function CartConfirmation({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-20 right-4 z-[100] flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 shadow-lg"
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Check size={16} strokeWidth={3} />
          <span className="text-xs uppercase tracking-widest font-bold">Added to bag</span>
          <ShoppingBag size={14} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
