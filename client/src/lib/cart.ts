import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, getVariantStock } from "./products";

interface CartItem extends Product {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  isPreOrder?: boolean;
  preOrderTotalPrice?: number;
  preOrderEta?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, color?: string, size?: string, price?: number, isPreOrder?: boolean, preOrderTotalPrice?: number, preOrderEta?: string) => void;
  removeItem: (productId: string, color?: string, size?: string, isPreOrder?: boolean) => void;
  updateQuantity: (productId: string, quantity: number, color?: string, size?: string, isPreOrder?: boolean) => void;
  clearCart: () => void;
  saveCartForUser: (userId: string) => void;
  loadCartForUser: (userId: string) => void;
  clearUserCart: () => void;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity = 1, color, size, price, isPreOrder = false, preOrderTotalPrice, preOrderEta) => {
        const variantStock = getVariantStock(product, size, color);
        if (!isPreOrder && variantStock <= 0) return;
        const items = get().items;
        const itemPrice = price ?? product.price;
        const existingItem = items.find(
          (item) => 
            item.id === product.id && 
            item.selectedColor === color && 
            item.selectedSize === size &&
            item.isPreOrder === isPreOrder
        );

        if (existingItem) {
          const newQuantity = isPreOrder ? existingItem.quantity + quantity : Math.min(existingItem.quantity + quantity, variantStock);
          set({
            items: items.map((item) =>
              item.id === product.id && 
              item.selectedColor === color && 
              item.selectedSize === size &&
              item.isPreOrder === isPreOrder
                ? { ...item, quantity: newQuantity }
                : item
            ),
          });
        } else {
          const cappedQuantity = isPreOrder ? quantity : Math.min(quantity, variantStock);
          set({ 
            items: [...items, { 
              ...product, 
              price: itemPrice, 
              quantity: cappedQuantity, 
              selectedColor: color, 
              selectedSize: size,
              isPreOrder,
              preOrderTotalPrice,
              preOrderEta
            }] 
          });
        }
      },
      removeItem: (productId, color, size, isPreOrder = false) => {
        set({ 
          items: get().items.filter(
            (item) => !(item.id === productId && item.selectedColor === color && item.selectedSize === size && (item.isPreOrder || false) === isPreOrder)
          ) 
        });
      },
      updateQuantity: (productId, quantity, color, size, isPreOrder = false) => {
        set({
          items: get().items.map((item) => {
            if (item.id === productId && item.selectedColor === color && item.selectedSize === size && (item.isPreOrder || false) === isPreOrder) {
              if (item.isPreOrder) {
                return { ...item, quantity: Math.max(1, quantity) };
              }
              const variantStock = getVariantStock(item, size, color);
              const cappedQuantity = Math.min(Math.max(1, quantity), variantStock);
              return { ...item, quantity: cappedQuantity };
            }
            return item;
          }),
        });
      },
      clearCart: () => set({ items: [] }),
      saveCartForUser: (userId: string) => {
        const items = get().items;
        if (items.length > 0) {
          localStorage.setItem(`cart-${userId}`, JSON.stringify(items));
        }
      },
      loadCartForUser: (userId: string) => {
        const saved = localStorage.getItem(`cart-${userId}`);
        if (saved) {
          try {
            const savedItems = JSON.parse(saved) as CartItem[];
            const currentItems = get().items;
            const mergedItems = [...currentItems];
            
            savedItems.forEach((savedItem) => {
              const exists = mergedItems.find(
                (item) => 
                  item.id === savedItem.id && 
                  item.selectedColor === savedItem.selectedColor && 
                  item.selectedSize === savedItem.selectedSize &&
                  (item.isPreOrder || false) === (savedItem.isPreOrder || false)
              );
              if (!exists) {
                mergedItems.push(savedItem);
              }
            });
            
            set({ items: mergedItems });
          } catch (e) {
            console.error("Failed to load user cart:", e);
          }
        }
      },
      clearUserCart: () => {
        set({ items: [] });
      },
    }),
    { name: "cart-storage" }
  )
);
