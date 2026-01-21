import { Product } from "./products";

const API_BASE = "/api";

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percentage" | "flat";
  status: string;
}

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  color?: string;
  size?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: "cod" | "bank";
  paymentSlip?: string;
  status: string;
  couponCode?: string;
  createdAt?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export const api = {
  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products`);
    return res.json();
  },

  async getProduct(id: string): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}`);
    return res.json();
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    return res.json();
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    return res.json();
  },

  async deleteProduct(id: string): Promise<void> {
    await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
  },

  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    const res = await fetch(`${API_BASE}/coupons`);
    return res.json();
  },

  async validateCoupon(code: string): Promise<{ valid: boolean; coupon?: Coupon }> {
    const res = await fetch(`${API_BASE}/coupons/validate/${code}`);
    return res.json();
  },

  async createCoupon(coupon: { code: string; discount: number; type: string; status: string }): Promise<Coupon> {
    const res = await fetch(`${API_BASE}/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coupon),
    });
    return res.json();
  },

  async deleteCoupon(id: string): Promise<void> {
    await fetch(`${API_BASE}/coupons/${id}`, { method: "DELETE" });
  },

  // Orders
  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders`);
    return res.json();
  },

  async getOrder(id: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    return res.json();
  },

  async trackOrder(orderNumber: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/track/${orderNumber}`);
    return res.json();
  },

  async createOrder(order: Omit<Order, "id" | "orderNumber" | "createdAt">): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    return res.json();
  },

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Admin Auth
  async adminLogin(email: string, password: string): Promise<{ success: boolean; admin?: Admin; message?: string }> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getAdmins(): Promise<Admin[]> {
    const res = await fetch(`${API_BASE}/admins`);
    return res.json();
  },

  async createAdmin(admin: { name: string; email: string; password: string }): Promise<Admin> {
    const res = await fetch(`${API_BASE}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(admin),
    });
    return res.json();
  },

  // Customer Auth
  async customerSignup(data: { name: string; email: string; password: string; phone?: string }): Promise<{ success: boolean; customer?: Customer; message?: string }> {
    const res = await fetch(`${API_BASE}/customers/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async customerLogin(email: string, password: string): Promise<{ success: boolean; customer?: Customer; message?: string }> {
    const res = await fetch(`${API_BASE}/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getCustomer(id: string): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers/${id}`);
    return res.json();
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
