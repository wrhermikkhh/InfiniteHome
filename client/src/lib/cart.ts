import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "./products";

interface CartItem extends Product {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, color?: string, size?: string, price?: number) => void;
  removeItem: (productId: string, color?: string, size?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string, size?: string) => void;
  clearCart: () => void;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity = 1, color, size, price) => {
        const items = get().items;
        const itemPrice = price ?? product.price;
        const existingItem = items.find(
          (item) => 
            item.id === product.id && 
            item.selectedColor === color && 
            item.selectedSize === size
        );

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.id === product.id && 
              item.selectedColor === color && 
              item.selectedSize === size
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          set({ 
            items: [...items, { ...product, price: itemPrice, quantity, selectedColor: color, selectedSize: size }] 
          });
        }
      },
      removeItem: (productId, color, size) => {
        set({ 
          items: get().items.filter(
            (item) => !(item.id === productId && item.selectedColor === color && item.selectedSize === size)
          ) 
        });
      },
      updateQuantity: (productId, quantity, color, size) => {
        set({
          items: get().items.map((item) =>
            item.id === productId && item.selectedColor === color && item.selectedSize === size
              ? { ...item, quantity } 
              : item
          ),
        });
      },
      clearCart: () => set({ items: [] }),
    }),
    { name: "cart-storage" }
  )
);
