import { 
  admins, type Admin, type InsertAdmin,
  customers, type Customer, type InsertCustomer,
  customerAddresses, type CustomerAddress, type InsertCustomerAddress,
  categories, type Category, type InsertCategory,
  products, type Product, type InsertProduct,
  coupons, type Coupon, type InsertCoupon,
  orders, type Order, type InsertOrder
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, sql } from "drizzle-orm";

export interface IStorage {
  // Customers
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Customer Addresses
  getCustomerAddresses(customerId: string): Promise<CustomerAddress[]>;
  createCustomerAddress(address: InsertCustomerAddress): Promise<CustomerAddress>;
  updateCustomerAddress(id: string, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | undefined>;
  deleteCustomerAddress(id: string): Promise<boolean>;
  setDefaultAddress(customerId: string, addressId: string): Promise<void>;
  
  // Admins
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  getAllAdmins(): Promise<Admin[]>;
  
  // Categories
  getAllCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  updateProductStock(id: string, stock: number): Promise<Product | undefined>;
  
  // Coupons
  getAllCoupons(): Promise<Coupon[]>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  deleteCoupon(id: string): Promise<boolean>;
  
  // Orders
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  
  // Stock Management
  deductStock(productId: string, size: string, color: string, quantity: number): Promise<void>;
  restoreStock(productId: string, size: string, color: string, quantity: number): Promise<void>;
  
  // Product Search
  searchProducts(query: string): Promise<Product[]>;
}

export class DatabaseStorage implements IStorage {
  // Customers
  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer || undefined;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated || undefined;
  }

  // Customer Addresses
  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    return await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customerId));
  }

  async createCustomerAddress(address: InsertCustomerAddress): Promise<CustomerAddress> {
    const [newAddress] = await db.insert(customerAddresses).values(address).returning();
    return newAddress;
  }

  async updateCustomerAddress(id: string, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | undefined> {
    const [updated] = await db.update(customerAddresses).set(data).where(eq(customerAddresses.id, id)).returning();
    return updated || undefined;
  }

  async deleteCustomerAddress(id: string): Promise<boolean> {
    await db.delete(customerAddresses).where(eq(customerAddresses.id, id));
    return true;
  }

  async setDefaultAddress(customerId: string, addressId: string): Promise<void> {
    await db.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, customerId));
    await db.update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, addressId));
  }

  // Admins
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db.insert(admins).values(admin).returning();
    return newAdmin;
  }

  async getAllAdmins(): Promise<Admin[]> {
    return await db.select().from(admins);
  }

  // Categories
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return true;
  }

  async updateProductStock(id: string, stock: number): Promise<Product | undefined> {
    const [updated] = await db.update(products).set({ stock }).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  // Coupons
  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await db.insert(coupons).values({ ...coupon, code: coupon.code.toUpperCase() }).returning();
    return newCoupon;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }

  // Orders
  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    const cleanEmail = email.trim().toLowerCase();
    return await db.select().from(orders).where(
      sql`LOWER(TRIM(${orders.customerEmail})) = ${cleanEmail}`
    );
  }

  async searchProducts(query: string): Promise<Product[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(products).where(
      or(
        ilike(products.name, searchPattern),
        ilike(products.description, searchPattern),
        ilike(products.category, searchPattern)
      )
    );
  }

  async deductStock(productId: string, size: string, color: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) return;

    const variantKey = `${size}-${color}`;
    const variantStock = (product.variantStock as { [key: string]: number } | null) || {};
    
    // Check if variant stock is being used
    if (Object.keys(variantStock).length > 0 && variantStock[variantKey] !== undefined) {
      // Deduct from variant stock
      const newVariantStock = { ...variantStock };
      newVariantStock[variantKey] = Math.max(0, (newVariantStock[variantKey] || 0) - quantity);
      await db.update(products).set({ variantStock: newVariantStock }).where(eq(products.id, productId));
    } else {
      // Deduct from general stock
      const newStock = Math.max(0, (product.stock || 0) - quantity);
      await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }

  async restoreStock(productId: string, size: string, color: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) return;

    const variantKey = `${size}-${color}`;
    const variantStock = (product.variantStock as { [key: string]: number } | null) || {};
    
    // Check if variant stock is being used
    if (Object.keys(variantStock).length > 0 && variantStock[variantKey] !== undefined) {
      // Restore to variant stock
      const newVariantStock = { ...variantStock };
      newVariantStock[variantKey] = (newVariantStock[variantKey] || 0) + quantity;
      await db.update(products).set({ variantStock: newVariantStock }).where(eq(products.id, productId));
    } else {
      // Restore to general stock
      const newStock = (product.stock || 0) + quantity;
      await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }
}

export const storage = new DatabaseStorage();
