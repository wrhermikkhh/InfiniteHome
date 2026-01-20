import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "./api";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const result = await api.adminLogin(email, password);
        if (result.success && result.admin) {
          set({
            user: {
              id: result.admin.id,
              name: result.admin.name,
              email: result.admin.email,
              role: "admin",
            },
            isAuthenticated: true,
          });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: "auth-storage" }
  )
);
