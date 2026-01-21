import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, Customer } from "./api";
import { useCart } from "./cart";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: "customer" | "admin";
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (data: { name: string; email: string; password: string; phone?: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const result = await api.customerLogin(email, password);
        if (result.success && result.customer) {
          set({
            user: {
              id: result.customer.id,
              name: result.customer.name,
              email: result.customer.email,
              phone: result.customer.phone,
              address: result.customer.address,
              role: "customer",
            },
            isAuthenticated: true,
          });
          useCart.getState().loadCartForUser(result.customer.id);
          return true;
        }
        return false;
      },
      signup: async (data) => {
        const result = await api.customerSignup(data);
        if (result.success && result.customer) {
          set({
            user: {
              id: result.customer.id,
              name: result.customer.name,
              email: result.customer.email,
              phone: result.customer.phone,
              address: result.customer.address,
              role: "customer",
            },
            isAuthenticated: true,
          });
          useCart.getState().loadCartForUser(result.customer.id);
          return { success: true };
        }
        return { success: false, message: result.message };
      },
      logout: () => {
        const currentUser = get().user;
        if (currentUser) {
          useCart.getState().saveCartForUser(currentUser.id);
        }
        set({ user: null, isAuthenticated: false });
      },
      updateProfile: (data) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...data } });
        }
      },
    }),
    { name: "customer-auth-storage" }
  )
);

// Separate admin auth for admin panel only
interface AdminAuthStore {
  admin: { id: string; name: string; email: string } | null;
  isAdminAuthenticated: boolean;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
}

export const useAdminAuth = create<AdminAuthStore>()(
  persist(
    (set) => ({
      admin: null,
      isAdminAuthenticated: false,
      adminLogin: async (email, password) => {
        const result = await api.adminLogin(email, password);
        if (result.success && result.admin) {
          set({
            admin: result.admin,
            isAdminAuthenticated: true,
          });
          return true;
        }
        return false;
      },
      adminLogout: () => set({ admin: null, isAdminAuthenticated: false }),
    }),
    { name: "admin-auth-storage" }
  )
);
