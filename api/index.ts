import express, { type Request, Response, NextFunction } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, ilike, or, sql } from "drizzle-orm";
import { Resend } from "resend";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// ============ PASSWORD HASHING ============
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// ============ INLINED SCHEMA ============

// Customers
const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
type InsertCustomer = z.infer<typeof insertCustomerSchema>;
type Customer = typeof customers.$inferSelect;

// Customer Addresses
const customerAddresses = pgTable("customer_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  label: text("label").notNull(),
  fullName: text("full_name").default(""),
  streetAddress: text("street_address").default(""),
  addressLine2: text("address_line_2"),
  cityIsland: text("city_island").default(""),
  zipCode: text("zip_code"),
  mobileNo: text("mobile_no").default(""),
  fullAddress: text("full_address").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertCustomerAddressSchema = createInsertSchema(customerAddresses).omit({ id: true, createdAt: true });
type InsertCustomerAddress = z.infer<typeof insertCustomerAddressSchema>;
type CustomerAddress = typeof customerAddresses.$inferSelect;

// Admin Users
const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
type InsertAdmin = z.infer<typeof insertAdminSchema>;
type Admin = typeof admins.$inferSelect;

// Categories
const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
type InsertCategory = z.infer<typeof insertCategorySchema>;
type Category = typeof categories.$inferSelect;

// Products
const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  salePrice: real("sale_price"),
  category: text("category").notNull(),
  image: text("image").notNull(),
  images: jsonb("images").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  colorImages: jsonb("color_images").$type<{ [color: string]: string }>().default({}),
  variants: jsonb("variants").$type<{ size: string; price: number }[]>().default([]),
  stock: integer("stock").default(0),
  variantStock: jsonb("variant_stock").$type<{ [key: string]: number }>().default({}),
  expressCharge: real("express_charge").default(0),
  rating: real("rating").default(5),
  reviews: integer("reviews").default(0),
  isNew: boolean("is_new").default(false),
  isBestSeller: boolean("is_best_seller").default(false),
  isOnSale: boolean("is_on_sale").default(false),
  sizeGuide: jsonb("size_guide").$type<{ measurement: string; sizes: { [key: string]: string } }[]>().default([]),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  isPreOrder: boolean("is_pre_order").default(false),
  preOrderPrice: real("pre_order_price"),
  preOrderInitialPayment: real("pre_order_initial_payment"),
  preOrderEta: text("pre_order_eta"),
  productDetails: text("product_details"),
  materialsAndCare: text("materials_and_care"),
  showOnStorefront: boolean("show_on_storefront").default(true),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  sku: text("sku"),
  barcode: text("barcode"),
  costPrice: real("cost_price"),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
type InsertProduct = z.infer<typeof insertProductSchema>;
type Product = typeof products.$inferSelect;

// Coupons
const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discount: real("discount").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("active"),
  scope: text("scope").notNull().default("store"),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().default([]),
  allowedProducts: jsonb("allowed_products").$type<string[]>().default([]),
  allowPreOrder: boolean("allow_pre_order").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
type InsertCoupon = z.infer<typeof insertCouponSchema>;
type Coupon = typeof coupons.$inferSelect;

// Orders
const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  items: jsonb("items").$type<{ productId?: string; name: string; qty: number; price: number; color?: string; size?: string; isPreOrder?: boolean; preOrderTotalPrice?: number; preOrderEta?: string }[]>().notNull(),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").default(0),
  shipping: real("shipping").notNull(),
  total: real("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentSlip: text("payment_slip"),
  status: text("status").notNull().default("pending"),
  couponCode: text("coupon_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
type InsertOrder = z.infer<typeof insertOrderSchema>;
type Order = typeof orders.$inferSelect;

// POS Transactions
const posTransactions = pgTable("pos_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionNumber: text("transaction_number").notNull().unique(),
  items: jsonb("items").$type<{ productId: string; name: string; qty: number; price: number; color?: string; size?: string }[]>().notNull(),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").default(0),
  gstPercentage: real("gst_percentage").default(0),
  gstAmount: real("gst_amount").default(0),
  tax: real("tax").default(0),
  total: real("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  amountReceived: real("amount_received"),
  change: real("change").default(0),
  customerId: varchar("customer_id"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  cashierId: varchar("cashier_id").notNull(),
  cashierName: text("cashier_name").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

type PosTransaction = typeof posTransactions.$inferSelect;

const schema = { customers, customerAddresses, admins, categories, products, coupons, orders, posTransactions };

// ============ DATABASE CONNECTION ============

const databaseUrl = process.env.DATABASE_URL;

let db: any = null;
let sql_client: any = null;

// Wrap database initialization in try-catch to prevent serverless crashes
try {
  if (databaseUrl) {
    // Use postgres.js - pure JavaScript PostgreSQL client for serverless
    sql_client = postgres(databaseUrl, {
      ssl: 'require',
      max: 1, // Limit connections in serverless
      idle_timeout: 20,
      connect_timeout: 10
    });
    db = drizzle(sql_client, { schema });
    console.log("Postgres.js client initialized");
  } else {
    console.log("DATABASE_URL not configured");
  }
} catch (error: any) {
  console.error("Failed to initialize database:", error.message);
}

// ============ SUPABASE CLIENT FOR STORAGE ============

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

// Lazy initialization for Supabase client
let supabase: any = null;
let supabaseInitialized = false;

async function getSupabaseClient() {
  if (supabaseInitialized) return supabase;
  supabaseInitialized = true;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Supabase Storage not configured - SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return null;
  }
  
  try {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully");
    return supabase;
  } catch (e: any) {
    console.error("Failed to initialize Supabase client:", e.message);
    return null;
  }
}

// ============ EXPRESS APP ============

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  if (req.path === '/api/health') {
    return next();
  }
  if (!db) {
    return res.status(500).json({ 
      error: "Database not configured", 
      message: "DATABASE_URL environment variable is not set. Please configure it in Vercel project settings." 
    });
  }
  next();
});

// Simple ping endpoint - no database required
app.get("/api/ping", (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

app.get("/api/health", async (req, res) => {
  if (!sql_client) {
    return res.status(500).json({ status: "error", database: false, message: "DATABASE_URL not configured" });
  }
  try {
    await sql_client`SELECT 1`;
    res.json({ status: "ok", database: true });
  } catch (error: any) {
    res.status(500).json({ status: "error", database: false, message: error.message });
  }
});

// Email configuration check endpoint
app.get("/api/email/status", async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  res.json({
    configured: !!apiKey,
    keyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : null
  });
});

// Test email endpoint (for debugging)
app.post("/api/email/test", async (req, res) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'RESEND_API_KEY not configured',
        hint: 'Add RESEND_API_KEY to your Vercel environment variables'
      });
    }
    
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Email address required in body: { "to": "email@example.com" }' });
    }
    
    const resend = new Resend(apiKey);
    console.log('Vercel: Sending email with Resend API Key:', apiKey.substring(0, 10) + '...');
    
    const result = await resend.emails.send({
      from: 'INFINITE HOME <noreply@infinitehome.mv>',
      to: to,
      subject: 'Test Email from INFINITE HOME',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a1a; color: white; padding: 20px; text-align: center;">
            <h1>INFINITE HOME</h1>
          </div>
          <div style="padding: 20px;">
            <h2>Test Email</h2>
            <p>If you're seeing this, email is working correctly!</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          </div>
        </div>
      `
    });
    
    res.json({ 
      success: true, 
      messageId: result.data?.id,
      to: to
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// ============ STORAGE CLASS ============

class DatabaseStorage {
  private getDb() {
    if (!db) throw new Error("Database not configured");
    return db;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await this.getDb().select().from(customers).where(eq(customers.email, email));
    return customer || undefined;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await this.getDb().select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await this.getDb().insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await this.getDb().update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated || undefined;
  }

  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    return await this.getDb().select().from(customerAddresses).where(eq(customerAddresses.customerId, customerId));
  }

  async createCustomerAddress(address: InsertCustomerAddress): Promise<CustomerAddress> {
    const [newAddress] = await this.getDb().insert(customerAddresses).values(address).returning();
    return newAddress;
  }

  async updateCustomerAddress(id: string, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | undefined> {
    const [updated] = await this.getDb().update(customerAddresses).set(data).where(eq(customerAddresses.id, id)).returning();
    return updated || undefined;
  }

  async deleteCustomerAddress(id: string): Promise<boolean> {
    await this.getDb().delete(customerAddresses).where(eq(customerAddresses.id, id));
    return true;
  }

  async setDefaultAddress(customerId: string, addressId: string): Promise<void> {
    await this.getDb().update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, customerId));
    await this.getDb().update(customerAddresses).set({ isDefault: true }).where(eq(customerAddresses.id, addressId));
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await this.getDb().select().from(admins).where(eq(admins.email, email));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await this.getDb().insert(admins).values(admin).returning();
    return newAdmin;
  }

  async getAllAdmins(): Promise<Admin[]> {
    return await this.getDb().select().from(admins);
  }

  async getAllCategories(): Promise<Category[]> {
    return await this.getDb().select().from(categories);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await this.getDb().select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await this.getDb().insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await this.getDb().update(categories).set(data).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.getDb().delete(categories).where(eq(categories.id, id));
    return true;
  }

  async getAllProducts(): Promise<Product[]> {
    return await this.getDb().select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await this.getDb().select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await this.getDb().insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await this.getDb().update(products).set(product).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    await this.getDb().delete(products).where(eq(products.id, id));
    return true;
  }

  async updateProductStock(id: string, stock: number): Promise<Product | undefined> {
    const [updated] = await this.getDb().update(products).set({ stock }).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return await this.getDb().select().from(coupons);
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await this.getDb().select().from(coupons).where(eq(coupons.code, code.toUpperCase()));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await this.getDb().insert(coupons).values({ ...coupon, code: coupon.code.toUpperCase() }).returning();
    return newCoupon;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await this.getDb().delete(coupons).where(eq(coupons.id, id));
    return true;
  }

  async getAllOrders(): Promise<Order[]> {
    return await this.getDb().select().from(orders);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await this.getDb().select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await this.getDb().select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await this.getDb().select().from(orders).where(eq(orders.customerEmail, email));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await this.getDb().insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await this.getDb().update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return await this.getDb().select().from(products).where(
      or(
        ilike(products.name, `%${query}%`),
        ilike(products.description, `%${query}%`)
      )
    );
  }

  async deductStock(productId: string, size: string, color: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) return;

    const variantStock = (product.variantStock as { [key: string]: number } | null) || {};
    const variantKey = `${size}-${color}`;

    if (variantStock[variantKey] !== undefined) {
      variantStock[variantKey] = Math.max(0, variantStock[variantKey] - quantity);
      await this.getDb().update(products).set({ variantStock }).where(eq(products.id, productId));
    } else {
      const newStock = Math.max(0, (product.stock || 0) - quantity);
      await this.getDb().update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }

  async restoreStock(productId: string, size: string, color: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) return;

    const variantStock = (product.variantStock as { [key: string]: number } | null) || {};
    const variantKey = `${size}-${color}`;

    if (variantStock[variantKey] !== undefined) {
      variantStock[variantKey] = variantStock[variantKey] + quantity;
      await this.getDb().update(products).set({ variantStock }).where(eq(products.id, productId));
    } else {
      const newStock = (product.stock || 0) + quantity;
      await this.getDb().update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }

  // POS Transaction methods
  async getAllPosTransactions(): Promise<PosTransaction[]> {
    return await this.getDb().select().from(posTransactions);
  }

  async getPosTransaction(id: string): Promise<PosTransaction | undefined> {
    const [transaction] = await this.getDb().select().from(posTransactions).where(eq(posTransactions.id, id));
    return transaction || undefined;
  }

  async getTodayPosTransactions(): Promise<PosTransaction[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await this.getDb().select().from(posTransactions).where(
      sql`${posTransactions.createdAt} >= ${today.toISOString()}`
    );
  }

  async createPosTransaction(data: any): Promise<PosTransaction> {
    const [transaction] = await this.getDb().insert(posTransactions).values(data).returning();
    return transaction;
  }

  async updatePosTransaction(id: string, data: Partial<any>): Promise<PosTransaction | undefined> {
    const [updated] = await this.getDb().update(posTransactions).set(data).where(eq(posTransactions.id, id)).returning();
    return updated || undefined;
  }
}

const storage = new DatabaseStorage();

// ============ EMAIL FUNCTIONS ============

function getEmailBaseUrl() {
  // Use custom domain for production
  return 'https://infinitehome.mv';
}

function getEmailHeader() {
  return `
    <div style="padding: 40px 20px; text-align: center; background-color: #1a1a1a; color: #ffffff;">
      <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">INFINITE HOME</h1>
    </div>
  `;
}

function getEmailFooter() {
  return `
    <div style="padding: 30px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0 0 10px 0;">INFINITE HOME - Premium Bedding, Furniture & Appliances</p>
      <p style="margin: 0 0 10px 0;">Male', Maldives | Phone: 7840001 | WhatsApp: 9607840001</p>
      <p style="margin: 0;">Email: support@infinitehome.mv</p>
    </div>
  `;
}

function getItemsHtml(items: any[]) {
  return items.map((item: any) => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee;">
        <div style="font-weight: bold; color: #1a1a1a;">${item.name}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          ${item.color ? `<span style="margin-right: 10px;">Color: ${item.color}</span>` : ''}
          ${item.size ? `<span>Size: ${item.size}</span>` : ''}
        </div>
      </td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: center; vertical-align: top;">
        ${item.qty}
      </td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align: right; vertical-align: top; font-weight: bold;">
        MVR ${item.price.toLocaleString()}
      </td>
    </tr>
  `).join('');
}

async function sendOrderConfirmationEmail(order: any) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('RESEND_API_KEY not set, skipping email');
      return { success: false, reason: 'API key not configured' };
    }
    
    const resend = new Resend(apiKey);
    console.log('Vercel: Sending email with Resend API Key:', apiKey.substring(0, 10) + '...');
    const baseUrl = getEmailBaseUrl();
    const trackingUrl = `${baseUrl}/track?order=${order.orderNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #fcfaf7; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          ${getEmailHeader()}
          <div style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-top: 0;">Order Confirmation</h2>
            <p style="color: #333; line-height: 1.6;">Dear ${order.customerName},</p>
            <p style="color: #333; line-height: 1.6;">Thank you for your order! We're excited to get your items ready.</p>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">Order Number</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1a1a1a;">${order.orderNumber}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr style="border-bottom: 2px solid #1a1a1a;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>${getItemsHtml(order.items)}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 15px 10px; text-align: right; font-weight: bold;">Total</td>
                  <td style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 18px;">MVR ${order.total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${trackingUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Track Your Order</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; line-height: 1.6;">
              We'll send you another email when your order ships. If you have any questions, please contact us at support@infinitehome.mv or call 7840001.
            </p>
          </div>
          ${getEmailFooter()}
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: 'INFINITE HOME <noreply@infinitehome.mv>',
      to: order.customerEmail,
      subject: `Order Confirmed - ${order.orderNumber}`,
      html: html,
    });
    
    console.log('Order email result:', JSON.stringify(result, null, 2));
    
    // Also notify admin
    await resend.emails.send({
      from: 'INFINITE HOME <noreply@infinitehome.mv>',
      to: 'sales@infinitehome.mv',
      subject: `NEW ORDER - ${order.orderNumber}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
        <p><strong>Total:</strong> MVR ${order.total.toLocaleString()}</p>
        <hr/>
        <h3>Items:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px solid #eee;">Item</th>
              <th style="text-align: center; border-bottom: 1px solid #eee;">Qty</th>
              <th style="text-align: right; border-bottom: 1px solid #eee;">Price</th>
            </tr>
          </thead>
          <tbody>${getItemsHtml(order.items)}</tbody>
        </table>
        <p><a href="${baseUrl}/admin">View in Admin Panel</a></p>
      `,
    }).then(res => console.log('Admin email result:', JSON.stringify(res, null, 2)))
      .catch(err => console.error("Admin notification failed:", err));
    
    console.log('Order confirmation email result:', JSON.stringify(result, null, 2));
    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error('Error sending order confirmation email:', error);
    return { success: false, reason: error.message };
  }
}

async function sendOrderStatusEmail(order: any, newStatus: string) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('RESEND_API_KEY not set, skipping status email');
      return { success: false, reason: 'API key not configured' };
    }
    
    const resend = new Resend(apiKey);
    console.log('Vercel: Sending email with Resend API Key:', apiKey.substring(0, 10) + '...');
    const baseUrl = getEmailBaseUrl();
    const trackingUrl = `${baseUrl}/track?order=${order.orderNumber}`;
    
    // Define email content based on status
    const statusContent: { [key: string]: { subject: string; title: string; message: string; icon: string } } = {
      confirmed: {
        subject: `Order Confirmed - ${order.orderNumber}`,
        title: 'Order Confirmed!',
        message: 'Great news! Your order has been confirmed and payment verified. We are now preparing your items for shipment.',
        icon: '✓'
      },
      processing: {
        subject: `Preparing Your Order - ${order.orderNumber}`,
        title: 'Preparing Your Order',
        message: 'Your order is being prepared for shipment. Our team is carefully packing your items to ensure they arrive in perfect condition.',
        icon: '📦'
      },
      shipped: {
        subject: `Your Order Has Shipped! - ${order.orderNumber}`,
        title: 'Order Shipped!',
        message: 'Exciting news! Your order has been handed over to our delivery partner and is on its way to you.',
        icon: '🚚'
      },
      in_transit: {
        subject: `Order In Transit - ${order.orderNumber}`,
        title: 'On The Way',
        message: 'Your package is moving through our delivery network and will arrive soon.',
        icon: '📍'
      },
      out_for_delivery: {
        subject: `Out for Delivery Today! - ${order.orderNumber}`,
        title: 'Arriving Today!',
        message: 'Your order is out for delivery! Our delivery partner will arrive at your address today. Please ensure someone is available to receive the package.',
        icon: '🏠'
      },
      delivered: {
        subject: `Order Delivered - ${order.orderNumber}`,
        title: 'Order Delivered!',
        message: 'Your order has been successfully delivered! We hope you love your new items. Thank you for shopping with INFINITE HOME.',
        icon: '🎉'
      },
      cancelled: {
        subject: `Order Cancelled - ${order.orderNumber}`,
        title: 'Order Cancelled',
        message: 'Your order has been cancelled. If you did not request this cancellation, please contact us immediately.',
        icon: '✕'
      },
      refunded: {
        subject: `Refund Processed - ${order.orderNumber}`,
        title: 'Refund Processed',
        message: 'Your refund has been processed. Please allow 5-7 business days for the amount to reflect in your account.',
        icon: '💰'
      }
    };
    
    const content = statusContent[newStatus];
    if (!content) {
      console.log(`No email template for status: ${newStatus}`);
      return { success: false, reason: 'No template for this status' };
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #fcfaf7; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          ${getEmailHeader()}
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="font-size: 48px; margin-bottom: 10px;">${content.icon}</div>
              <h2 style="color: #1a1a1a; font-size: 24px; margin: 0;">${content.title}</h2>
            </div>
            
            <p style="color: #333; line-height: 1.6;">Dear ${order.customerName},</p>
            <p style="color: #333; line-height: 1.6;">${content.message}</p>
            
            <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">Order Number</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1a1a1a;">${order.orderNumber}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${trackingUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Track Your Order</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; line-height: 1.6;">
              If you have any questions, please contact us at support@infinitehome.mv or call 7840001.
            </p>
          </div>
          ${getEmailFooter()}
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: 'INFINITE HOME <noreply@infinitehome.mv>',
      to: order.customerEmail,
      subject: content.subject,
      html: html,
    });
    
    console.log(`Status email (${newStatus}) sent:`, result);
    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error('Error sending status email:', error);
    return { success: false, reason: error.message };
  }
}

// ============ API ROUTES ============

// Customer Auth
app.post("/api/customers/signup", async (req, res) => {
  try {
    const data = insertCustomerSchema.parse(req.body);
    const existing = await storage.getCustomerByEmail(data.email);
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    
    const hashedPassword = await hashPassword(data.password);
    const customer = await storage.createCustomer({ ...data, password: hashedPassword });
    
    res.json({ 
      success: true, 
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } 
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/api/customers/login", async (req, res) => {
  const { email, password } = req.body;
  const customer = await storage.getCustomerByEmail(email);
  if (customer && await comparePasswords(password, customer.password)) {
    res.json({ 
      success: true, 
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } 
    });
  } else {
    res.status(401).json({ success: false, message: "Invalid email or password" });
  }
});

app.get("/api/customers/:id", async (req, res) => {
  const customer = await storage.getCustomer(req.params.id);
  if (customer) {
    res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address });
  } else {
    res.status(404).json({ message: "Customer not found" });
  }
});

app.patch("/api/customers/:id", async (req, res) => {
  try {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (customer) {
      res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address });
    } else {
      res.status(404).json({ message: "Customer not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Customer Addresses
app.get("/api/customers/:customerId/addresses", async (req, res) => {
  const addresses = await storage.getCustomerAddresses(req.params.customerId);
  res.json(addresses);
});

app.post("/api/customers/:customerId/addresses", async (req, res) => {
  try {
    const data = insertCustomerAddressSchema.parse({ ...req.body, customerId: req.params.customerId });
    const address = await storage.createCustomerAddress(data);
    res.json(address);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/addresses/:id", async (req, res) => {
  try {
    const address = await storage.updateCustomerAddress(req.params.id, req.body);
    if (address) {
      res.json(address);
    } else {
      res.status(404).json({ message: "Address not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/addresses/:id", async (req, res) => {
  await storage.deleteCustomerAddress(req.params.id);
  res.json({ success: true });
});

app.post("/api/customers/:customerId/addresses/:addressId/default", async (req, res) => {
  await storage.setDefaultAddress(req.params.customerId, req.params.addressId);
  res.json({ success: true });
});

// Admin Auth
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = await storage.getAdminByEmail(email);
  if (admin && await comparePasswords(password, admin.password)) {
    res.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

app.get("/api/admins", async (req, res) => {
  const allAdmins = await storage.getAllAdmins();
  res.json(allAdmins.map(a => ({ id: a.id, name: a.name, email: a.email })));
});

app.post("/api/admins", async (req, res) => {
  try {
    const data = insertAdminSchema.parse(req.body);
    const hashedPassword = await hashPassword(data.password);
    const admin = await storage.createAdmin({ ...data, password: hashedPassword });
    res.json({ id: admin.id, name: admin.name, email: admin.email });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Categories
app.get("/api/categories", async (req, res) => {
  const allCategories = await storage.getAllCategories();
  res.json(allCategories);
});

app.post("/api/categories", async (req, res) => {
  try {
    const data = insertCategorySchema.parse(req.body);
    const existing = await storage.getCategoryByName(data.name);
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }
    const category = await storage.createCategory(data);
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/categories/:id", async (req, res) => {
  try {
    const category = await storage.updateCategory(req.params.id, req.body);
    if (category) {
      res.json(category);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  await storage.deleteCategory(req.params.id);
  res.json({ success: true });
});

// Products
app.get("/api/products", async (req, res) => {
  const allProducts = await storage.getAllProducts();
  res.json(allProducts);
});

app.get("/api/storefront/products", async (req, res) => {
  const allProducts = await storage.getAllProducts();
  const storefrontProducts = allProducts.filter((p: any) => p.showOnStorefront !== false);
  res.json(storefrontProducts);
});

app.get("/api/products/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.trim().length === 0) {
    return res.json([]);
  }
  const results = await storage.searchProducts(query.trim());
  res.json(results);
});

app.get("/api/products/:id", async (req, res) => {
  const product = await storage.getProduct(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: "Product not found" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/products/:id", async (req, res) => {
  try {
    const product = await storage.updateProduct(req.params.id, req.body);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  await storage.deleteProduct(req.params.id);
  res.json({ success: true });
});

app.patch("/api/products/:id/stock", async (req, res) => {
  try {
    const { stock } = req.body;
    if (typeof stock !== "number" || stock < 0) {
      return res.status(400).json({ message: "Invalid stock value" });
    }
    const product = await storage.updateProductStock(req.params.id, stock);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Coupons
app.get("/api/coupons", async (req, res) => {
  const allCoupons = await storage.getAllCoupons();
  res.json(allCoupons);
});

app.get("/api/coupons/validate/:code", async (req, res) => {
  const coupon = await storage.getCouponByCode(req.params.code);
  if (coupon && coupon.status === "active") {
    res.json({ valid: true, coupon });
  } else {
    res.json({ valid: false });
  }
});

// Validate coupon with cart items - returns which items are eligible
app.post("/api/coupons/validate", async (req, res) => {
  try {
    const { code, items } = req.body;
    const coupon = await storage.getCouponByCode(code);
    
    if (!coupon || coupon.status !== "active") {
      return res.json({ valid: false, message: "Invalid or expired coupon" });
    }

    const eligibleItems: number[] = [];
    let eligibleSubtotal = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isPreOrder = item.isPreOrder || false;
      
      if (isPreOrder && !coupon.allowPreOrder) {
        continue;
      }

      if (coupon.scope === "store") {
        eligibleItems.push(i);
        eligibleSubtotal += item.price * item.qty;
      } else if (coupon.scope === "category") {
        const allowedCategories = coupon.allowedCategories || [];
        if (item.category && allowedCategories.includes(item.category)) {
          eligibleItems.push(i);
          eligibleSubtotal += item.price * item.qty;
        }
      } else if (coupon.scope === "product") {
        const allowedProducts = coupon.allowedProducts || [];
        if (item.productId && allowedProducts.includes(item.productId)) {
          eligibleItems.push(i);
          eligibleSubtotal += item.price * item.qty;
        }
      }
    }

    if (eligibleItems.length === 0) {
      return res.json({ valid: false, message: "Coupon does not apply to items in your cart" });
    }

    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = (eligibleSubtotal * coupon.discount) / 100;
    } else {
      discountAmount = Math.min(coupon.discount, eligibleSubtotal);
    }

    res.json({
      valid: true,
      coupon,
      eligibleItems,
      eligibleSubtotal,
      discountAmount,
      message: eligibleItems.length < items.length 
        ? `Coupon applied to ${eligibleItems.length} of ${items.length} items`
        : undefined
    });
  } catch (error: any) {
    res.status(400).json({ valid: false, message: error.message });
  }
});

app.post("/api/coupons", async (req, res) => {
  try {
    const data = insertCouponSchema.parse(req.body);
    const coupon = await storage.createCoupon(data);
    res.json(coupon);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/coupons/:id", async (req, res) => {
  await storage.deleteCoupon(req.params.id);
  res.json({ success: true });
});

// Orders
app.get("/api/orders", async (req, res) => {
  const allOrders = await storage.getAllOrders();
  res.json(allOrders);
});

app.get("/api/orders/customer/:email", async (req, res) => {
  const customerOrders = await storage.getOrdersByEmail(req.params.email);
  res.json(customerOrders);
});

app.get("/api/orders/:id", async (req, res) => {
  const order = await storage.getOrder(req.params.id);
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: "Order not found" });
  }
});

app.get("/api/orders/track/:orderNumber", async (req, res) => {
  const order = await storage.getOrderByNumber(req.params.orderNumber);
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ message: "Order not found" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const items = req.body.items as { productId?: string; name: string; qty: number; price: number; color?: string; size?: string }[];
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in order" });
    }
    
    const allProducts = await storage.getAllProducts();
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    
    const stockErrors: string[] = [];
    for (const item of items) {
      if (!item.productId) {
        stockErrors.push(`Product ID missing for "${item.name}"`);
        continue;
      }
      
      const product = productMap.get(item.productId);
      
      if (!product) {
        stockErrors.push(`Product "${item.name}" not found (ID: ${item.productId})`);
        continue;
      }
      
      const productColors = (product.colors as string[] | null) || [];
      const productVariants = (product.variants as { size: string; price: number }[] | null) || [];
      const productSizes = productVariants.map(v => v.size);
      
      const requestedColor = item.color || 'Default';
      const requestedSize = item.size || 'Standard';
      
      if (productColors.length > 0 && requestedColor !== 'Default' && !productColors.includes(requestedColor)) {
        stockErrors.push(`Invalid color "${requestedColor}" for ${item.name}`);
        continue;
      }
      
      if (productSizes.length > 0 && requestedSize !== 'Standard' && !productSizes.includes(requestedSize)) {
        stockErrors.push(`Invalid size "${requestedSize}" for ${item.name}`);
        continue;
      }
      
      const variantStock = product.variantStock as { [key: string]: number } | null;
      const variantKey = `${requestedSize}-${requestedColor}`;
      let availableStock = 0;
      
      if (variantStock && Object.keys(variantStock).length > 0) {
        if (variantStock[variantKey] !== undefined) {
          availableStock = variantStock[variantKey];
        } else {
          const matchingKey = Object.keys(variantStock).find(key => 
            key.toLowerCase() === variantKey.toLowerCase()
          );
          if (matchingKey) {
            availableStock = variantStock[matchingKey];
          } else {
            const sizeMatch = Object.keys(variantStock).find(key => 
              key.toLowerCase().startsWith(requestedSize.toLowerCase() + '-')
            );
            const colorMatch = Object.keys(variantStock).find(key => 
              key.toLowerCase().endsWith('-' + requestedColor.toLowerCase())
            );
            if (sizeMatch) availableStock = variantStock[sizeMatch];
            else if (colorMatch) availableStock = variantStock[colorMatch];
          }
        }
      }
      
      if (availableStock <= 0) {
        stockErrors.push(`${item.name} (${requestedSize}/${requestedColor}) is out of stock`);
      } else if (item.qty > availableStock) {
        stockErrors.push(`${item.name} (${requestedSize}/${requestedColor}) only has ${availableStock} available`);
      }
    }
    
    if (stockErrors.length > 0) {
      return res.status(400).json({ message: "Stock validation failed: " + stockErrors.join("; ") });
    }
    
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomId = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orderNumber = randomId;
    const data = insertOrderSchema.parse({ ...req.body, orderNumber });
    const order = await storage.createOrder(data);
    
    for (const item of items) {
      if (item.productId) {
        const size = item.size || 'Standard';
        const color = item.color || 'Default';
        await storage.deductStock(item.productId, size, color, item.qty);
      }
    }
    
    sendOrderConfirmationEmail(order).catch(err => {
      console.error("Email delivery failed:", err);
    });
    
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    const currentOrder = await storage.getOrder(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    const previousStatus = currentOrder.status;
    const order = await storage.updateOrderStatus(req.params.id, status);
    
    if (order) {
      if (status === 'cancelled' && previousStatus !== 'cancelled') {
        const items = order.items as { productId?: string; name: string; qty: number; size?: string; color?: string }[];
        for (const item of items) {
          if (item.productId) {
            const size = item.size || 'Standard';
            const color = item.color || 'Default';
            await storage.restoreStock(item.productId, size, color, item.qty);
          }
        }
      }
      
      // Send status update email if status changed
      if (previousStatus !== status) {
        sendOrderStatusEmail(order, status).catch(err => {
          console.error("Status email delivery failed:", err);
        });
      }
      
      res.json(order);
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// ============ FILE UPLOADS (Supabase Storage) ============

// Storage health check endpoint
app.get("/api/storage/health", async (req, res) => {
  const status: any = {
    supabaseUrl: supabaseUrl ? "configured" : "missing",
    supabaseKey: supabaseServiceKey ? "configured" : "missing"
  };

  try {
    const client = await getSupabaseClient();
    status.supabaseClient = client ? "initialized" : "not initialized";

    if (!client) {
      return res.status(500).json({ 
        status: "error", 
        message: "Storage not configured - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        details: status
      });
    }

    // Try to list buckets to verify connection
    const { data: buckets, error: listError } = await client.storage.listBuckets();
    
    if (listError) {
      return res.status(500).json({ 
        status: "error", 
        message: "Failed to connect to Supabase Storage",
        error: listError.message,
        details: status
      });
    }

    const bucketNames = buckets?.map((b: any) => b.name) || [];
    const hasInfiniteHome = bucketNames.includes('infinite-home');

    res.json({
      status: hasInfiniteHome ? "ok" : "bucket_missing",
      message: hasInfiniteHome 
        ? "Supabase Storage is configured correctly" 
        : "Bucket 'infinite-home' not found. Please create it in Supabase Storage.",
      buckets: bucketNames,
      details: status
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: "error", 
      message: "Failed to check storage status",
      error: error.message,
      details: status
    });
  }
});

app.post("/api/uploads/request-url", async (req, res) => {
  try {
    const client = await getSupabaseClient();
    
    if (!client) {
      return res.status(500).json({ 
        error: "Storage not configured", 
        message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables" 
      });
    }

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = `uploads/${fileId}`;

    console.log("Creating signed upload URL for:", filePath);

    const { data, error } = await client.storage
      .from('infinite-home')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase storage error:", error);
      return res.status(500).json({ error: "Failed to generate upload URL", details: error.message });
    }

    // Return the signed URL and the public URL path
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/infinite-home/${filePath}`;
    
    console.log("Upload URL generated successfully, public path:", publicUrl);
    
    res.json({
      uploadURL: data.signedUrl,
      token: data.token,
      path: data.path,
      objectPath: publicUrl
    });
  } catch (error: any) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL", details: error.message });
  }
});

// Direct file upload endpoint for product images (handles FormData)
app.post("/api/uploads/product-images", async (req, res) => {
  try {
    const client = await getSupabaseClient();
    
    if (!client) {
      return res.status(500).json({ 
        error: "Storage not configured", 
        message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" 
      });
    }

    // In Vercel serverless, we need to handle the raw body
    // The body should be the file buffer when content-type is multipart/form-data
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
    }

    // For Vercel, we need to parse the multipart form manually or use a different approach
    // Since Express body parsing doesn't work well with multipart in serverless,
    // we'll use a signed URL approach instead
    
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = `uploads/${fileId}`;

    // Create a signed upload URL for client-side upload
    const { data, error } = await client.storage
      .from('product-images')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      return res.status(500).json({ error: "Failed to generate upload URL", details: error.message });
    }

    // Return signed URL for client to upload directly
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}`;
    
    res.json({
      uploadURL: data.signedUrl,
      token: data.token,
      path: data.path,
      objectPath: publicUrl,
      method: "signed_url",
      message: "Use the uploadURL to PUT your file directly to Supabase"
    });
  } catch (error: any) {
    console.error("Error in product-images upload:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

// Direct file upload endpoint for payment slips (public bucket, separate from product images)
app.post("/api/uploads/payment-slips", async (req, res) => {
  try {
    const client = await getSupabaseClient();
    
    if (!client) {
      return res.status(500).json({ 
        error: "Storage not configured", 
        message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set" 
      });
    }

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const filePath = `uploads/${fileId}`;

    const { data, error } = await client.storage
      .from('payment-slips')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      return res.status(500).json({ error: "Failed to generate upload URL", details: error.message });
    }

    // Return public URL directly (bucket should be set to public in Supabase)
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/payment-slips/${filePath}`;

    res.json({
      uploadURL: data.signedUrl,
      token: data.token,
      path: filePath,
      objectPath: publicUrl,
      method: "signed_url"
    });
  } catch (error: any) {
    console.error("Error in payment-slips upload:", error);
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

// Get URL for viewing payment slips (returns public URL)
app.post("/api/payment-slips/get-url", async (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: "Path is required" });
    }

    // Return public URL directly
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/payment-slips/${path}`;
    res.json({ url: publicUrl });
  } catch (error: any) {
    console.error("Error getting payment slip URL:", error);
    res.status(500).json({ error: "Failed to get payment slip" });
  }
});

// Serve object paths (redirect to Supabase Storage public URL)
app.get("/objects/{*path}", (req, res) => {
  // For legacy paths, redirect to placeholder or return 404
  // New uploads use full Supabase URLs
  res.status(404).json({ error: "Object not found" });
});

// ============ POS ROUTES ============

app.get("/api/pos/transactions", async (req, res) => {
  try {
    const transactions = await storage.getAllPosTransactions();
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/pos/transactions/today", async (req, res) => {
  try {
    const transactions = await storage.getTodayPosTransactions();
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/pos/transactions/:id", async (req, res) => {
  try {
    const transaction = await storage.getPosTransaction(req.params.id);
    if (transaction) {
      res.json(transaction);
    } else {
      res.status(404).json({ message: "Transaction not found" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/pos/transactions", async (req, res) => {
  try {
    const items = req.body.items as { productId: string; name: string; qty: number; price: number; color?: string; size?: string }[];
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in transaction" });
    }

    // Validate stock for each item (using variant stock only)
    const allProducts = await storage.getAllProducts();
    const productMap = new Map(allProducts.map((p: any) => [p.id, p]));
    
    const stockErrors: string[] = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        stockErrors.push(`Product "${item.name}" not found`);
        continue;
      }
      
      const variantStock = product.variantStock as { [key: string]: number } | null;
      const itemSize = item.size || 'Standard';
      const itemColor = item.color || 'Default';
      const variantKey = `${itemSize}-${itemColor}`;
      let availableStock = 0;
      
      // Check variant stock with fallback matching
      if (variantStock && Object.keys(variantStock).length > 0) {
        // Try exact match first
        if (variantStock[variantKey] !== undefined) {
          availableStock = variantStock[variantKey];
        } else {
          // Try case-insensitive match
          const matchingKey = Object.keys(variantStock).find(key => 
            key.toLowerCase() === variantKey.toLowerCase()
          );
          if (matchingKey) {
            availableStock = variantStock[matchingKey];
          } else {
            // Try partial match (just size or just color)
            const sizeMatch = Object.keys(variantStock).find(key => 
              key.toLowerCase().startsWith(itemSize.toLowerCase() + '-')
            );
            const colorMatch = Object.keys(variantStock).find(key => 
              key.toLowerCase().endsWith('-' + itemColor.toLowerCase())
            );
            if (sizeMatch) {
              availableStock = variantStock[sizeMatch];
            } else if (colorMatch) {
              availableStock = variantStock[colorMatch];
            }
          }
        }
      }
      
      if (availableStock < item.qty) {
        stockErrors.push(`${item.name} (${itemSize}/${itemColor}) only has ${availableStock} available`);
      }
    }
    
    if (stockErrors.length > 0) {
      return res.status(400).json({ message: "Stock validation failed: " + stockErrors.join("; ") });
    }

    // Generate transaction number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const transactionNumber = `POS-${dateStr}-${timeStr}-${randomSuffix}`;

    // Manually construct the transaction data
    const data = {
      transactionNumber,
      items: req.body.items,
      subtotal: Number(req.body.subtotal) || 0,
      discount: Number(req.body.discount) || 0,
      gstPercentage: Number(req.body.gstPercentage) || 0,
      gstAmount: Number(req.body.gstAmount) || 0,
      tax: Number(req.body.tax) || 0,
      total: Number(req.body.total) || 0,
      paymentMethod: String(req.body.paymentMethod || "cash"),
      amountReceived: Number(req.body.amountReceived) || 0,
      change: Number(req.body.change) || 0,
      customerId: req.body.customerId || null,
      customerName: req.body.customerName || null,
      customerPhone: req.body.customerPhone || null,
      cashierId: String(req.body.cashierId || "default"),
      cashierName: String(req.body.cashierName || "Admin"),
      notes: req.body.notes || null,
      status: String(req.body.status || "completed"),
    };
    const transaction = await storage.createPosTransaction(data);

    // Deduct stock for each item
    for (const item of items) {
      const product = await storage.getProduct(item.productId);
      if (!product) continue;

      const size = item.size || (product.variants && product.variants.length > 0 ? product.variants[0].size : 'Standard');
      const color = item.color || (product.colors && product.colors.length > 0 ? product.colors[0] : 'Default');
      
      await storage.deductStock(item.productId, size, color, item.qty);
    }

    res.json(transaction);
  } catch (error: any) {
    console.error("POS Transaction Error:", error);
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/pos/transactions/:id", async (req, res) => {
  try {
    const transaction = await storage.updatePosTransaction(req.params.id, req.body);
    if (transaction) {
      res.json(transaction);
    } else {
      res.status(404).json({ message: "Transaction not found" });
    }
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/pos/stats/today", async (req, res) => {
  try {
    const transactions = await storage.getTodayPosTransactions();
    const completedTransactions = transactions.filter((t: any) => t.status === 'completed');
    
    const totalSales = completedTransactions.reduce((sum: number, t: any) => sum + (t.total || 0), 0);
    const totalTransactions = completedTransactions.length;
    const totalItems = completedTransactions.reduce((sum: number, t: any) => {
      const items = t.items as { qty: number }[];
      return sum + items.reduce((itemSum, item) => itemSum + item.qty, 0);
    }, 0);
    
    res.json({
      totalSales,
      totalTransactions,
      totalItems,
      averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ VERCEL HANDLER ============

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
