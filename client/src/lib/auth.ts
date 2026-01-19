import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, role?: "user" | "admin") => void;
  adminLogin: (password: string) => boolean;
  logout: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (email, role = "user") => {
        set({
          user: {
            id: "1",
            name: email.split("@")[0],
            email,
            role,
          },
          isAuthenticated: true,
        });
      },
      adminLogin: (password: string) => {
        // Simple password protection for mockup mode
        if (password === "admin123") {
          set({
            user: {
              id: "0",
              name: "Admin",
              email: "admin@infinitehome.mv",
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
