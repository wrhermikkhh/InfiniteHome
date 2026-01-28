import { Product } from "./products";

const API_BASE = "/api";

export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percentage" | "flat";
  status: string;
  scope?: string;
  allowedCategories?: string[];
  allowedProducts?: string[];
  allowPreOrder?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  eligibleItems?: number[];
  eligibleSubtotal?: number;
  discountAmount?: number;
  message?: string;
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

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  fullName?: string;
  streetAddress?: string;
  addressLine2?: string;
  cityIsland?: string;
  zipCode?: string;
  mobileNo?: string;
  fullAddress: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export const api = {
  // Categories
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories`);
    return res.json();
  },

  async createCategory(category: { name: string; description?: string }): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category),
    });
    return res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
  },


  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products`);
    return res.json();
  },

  async getStorefrontProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/storefront/products`);
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

  async updateProductStock(id: string, stock: number): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    return res.json();
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

  async validateCouponWithItems(code: string, items: { productId?: string; category?: string; price: number; qty: number; isPreOrder?: boolean }[]): Promise<CouponValidationResult> {
    const res = await fetch(`${API_BASE}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, items }),
    });
    return res.json();
  },

  async createCoupon(coupon: { code: string; discount: number; type: string; status: string; scope?: string; allowedCategories?: string[]; allowedProducts?: string[]; allowPreOrder?: boolean }): Promise<Coupon> {
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

  async getCustomerOrders(email: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders/customer/${encodeURIComponent(email)}`);
    return res.json();
  },

  async searchProducts(query: string): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
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

  // Customer Addresses
  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    const res = await fetch(`${API_BASE}/customers/${customerId}/addresses`);
    return res.json();
  },

  async createCustomerAddress(customerId: string, data: { 
    label: string; 
    fullName?: string;
    streetAddress?: string;
    addressLine2?: string;
    cityIsland?: string;
    zipCode?: string;
    mobileNo?: string;
    fullAddress: string; 
    isDefault?: boolean 
  }): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/customers/${customerId}/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateCustomerAddress(id: string, data: Partial<{ 
    label: string; 
    fullName?: string;
    streetAddress?: string;
    addressLine2?: string;
    cityIsland?: string;
    zipCode?: string;
    mobileNo?: string;
    fullAddress: string 
  }>): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteCustomerAddress(id: string): Promise<void> {
    await fetch(`${API_BASE}/addresses/${id}`, { method: "DELETE" });
  },

  async setDefaultAddress(customerId: string, addressId: string): Promise<void> {
    await fetch(`${API_BASE}/customers/${customerId}/addresses/${addressId}/default`, { method: "POST" });
  },

  // Payment Slips
  async getPaymentSlipUrl(path: string): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/payment-slips/get-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return res.json();
  },

  // POS System
  async getPosTransactions(): Promise<PosTransaction[]> {
    const res = await fetch(`${API_BASE}/pos/transactions`);
    return res.json();
  },

  async getAllPosTransactions(): Promise<PosTransaction[]> {
    const res = await fetch(`${API_BASE}/pos/transactions`);
    return res.json();
  },

  async getTodayPosTransactions(): Promise<PosTransaction[]> {
    const res = await fetch(`${API_BASE}/pos/transactions/today`);
    return res.json();
  },

  async getPosTransaction(id: string): Promise<PosTransaction> {
    const res = await fetch(`${API_BASE}/pos/transactions/${id}`);
    return res.json();
  },

  async createPosTransaction(transaction: Omit<PosTransaction, "id" | "transactionNumber" | "createdAt">): Promise<PosTransaction> {
    const res = await fetch(`${API_BASE}/pos/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    });
    return res.json();
  },

  async getPosStats(): Promise<{ totalSales: number; totalTransactions: number; totalItems: number; averageTransaction: number }> {
    const res = await fetch(`${API_BASE}/pos/stats/today`);
    return res.json();
  },
};

export interface PosTransaction {
  id: string;
  transactionNumber: string;
  items: { productId: string; name: string; qty: number; price: number; color?: string; size?: string }[];
  subtotal: number;
  discount: number;
  gstPercentage?: number;
  gstAmount?: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountReceived?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  cashierId: string;
  cashierName: string;
  notes?: string;
  status: string;
  createdAt?: string;
}
