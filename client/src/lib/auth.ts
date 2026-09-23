import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, Customer } from "./api";
import { useCart } from "./cart";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_ADMIN_PERMISSIONS, type AdminPermissions } from "@shared/admin-permissions";

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
  logout: () => Promise<void>;
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
      logout: async () => {
        try {
          const response = await fetch("/api/customers/logout", { method: "POST", credentials: "same-origin" });
          if (!response.ok) throw new Error("Please retry sign out to revoke your session.");
        } catch (error) {
          toast({ title: "Sign out failed", description: error instanceof Error ? error.message : "Please retry sign out.", variant: "destructive" });
          return;
        }
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
export type { AdminPermissions } from "@shared/admin-permissions";
export const DEFAULT_PERMISSIONS: AdminPermissions = DEFAULT_ADMIN_PERMISSIONS;

interface AdminAuthStore {
  admin: { id: string; name: string; email: string; isSuperAdmin?: boolean; permissions?: AdminPermissions } | null;
  isAdminAuthenticated: boolean;
  isAdminLoading: boolean;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const useAdminAuth = create<AdminAuthStore>()(
    (set, get) => ({
      admin: null,
      isAdminAuthenticated: false,
      isAdminLoading: true,
      adminLogin: async (email, password) => {
        const result = await api.adminLogin(email, password);
        if (result.success && result.admin) {
          set({
            admin: result.admin,
            isAdminAuthenticated: true,
            isAdminLoading: false,
          });
          return true;
        }
        return false;
      },
      refreshSession: async () => {
        set({ isAdminLoading: true });
        try {
          const response = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
          const result = await response.json();
          set(response.ok && result.admin
            ? { admin: result.admin, isAdminAuthenticated: true, isAdminLoading: false }
            : { admin: null, isAdminAuthenticated: false, isAdminLoading: false });
        } catch { set({ admin: null, isAdminAuthenticated: false, isAdminLoading: false }); }
      },
      refreshAdmin: async () => get().refreshSession(),
      adminLogout: async () => {
        const response = await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
        if (!response.ok) throw new Error("Logout failed. Please retry to revoke your session.");
        set({ admin: null, isAdminAuthenticated: false, isAdminLoading: false });
      },
    })
);
