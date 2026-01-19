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
  login: (email: string, password?: string) => boolean;
  logout: () => void;
  admins: { email: string; password: string; name: string }[];
  addAdmin: (email: string, password: string, name: string) => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      admins: [
        { email: "admin@infinitehome.mv", password: "admin123", name: "Super Admin" }
      ],
      login: (email, password) => {
        // Check admin list first
        const admin = get().admins.find(a => a.email === email && a.password === password);
        if (admin) {
          set({
            user: {
              id: Math.random().toString(36).substr(2, 9),
              name: admin.name,
              email: admin.email,
              role: "admin",
            },
            isAuthenticated: true,
          });
          return true;
        }

        // Regular user login (no password for mockup)
        if (!password) {
          set({
            user: {
              id: Math.random().toString(36).substr(2, 9),
              name: email.split("@")[0],
              email,
              role: "user",
            },
            isAuthenticated: true,
          });
          return true;
        }
        
        return false;
      },
      addAdmin: (email, password, name) => {
        set({
          admins: [...get().admins, { email, password, name }]
        });
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: "auth-storage" }
  )
);
