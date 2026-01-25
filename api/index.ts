import express, { type Request, Response, NextFunction } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, ilike, or, sql } from "drizzle-orm";
import { Resend } from "resend";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  category: text("category").notNull(),
  image: text("image").notNull(),
  images: jsonb("images").$type<string[]>().default([]),
  colors: jsonb("colors").$type<string[]>().default([]),
  variants: jsonb("variants").$type<{ size: string; price: number }[]>().default([]),
  stock: integer("stock").default(0),
  variantStock: jsonb("variant_stock").$type<{ [key: string]: number }>().default({}),
  expressCharge: real("express_charge").default(0),
  rating: real("rating").default(5),
  reviews: integer("reviews").default(0),
  isNew: boolean("is_new").default(false),
  isBestSeller: boolean("is_best_seller").default(false),
  sizeGuide: jsonb("size_guide").$type<{ measurement: string; sizes: { [key: string]: string } }[]>().default([]),
  isPreOrder: boolean("is_pre_order").default(false),
  preOrderPrice: real("pre_order_price"),
  preOrderInitialPayment: real("pre_order_initial_payment"),
  preOrderEta: text("pre_order_eta"),
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

const schema = { customers, customerAddresses, admins, categories, products, coupons, orders };

// ============ DATABASE CONNECTION ============

const databaseUrl = process.env.DATABASE_URL;

const { Pool } = pg;

let db: any = null;
let pool: pg.Pool | null = null;

if (databaseUrl) {
  // If sslmode is in the connection string, don't add conflicting SSL options
  const hasSSLMode = databaseUrl.includes('sslmode=');
  
  pool = new Pool({ 
    connectionString: databaseUrl,
    // Only set SSL if sslmode is not already in the connection string
    ...(hasSSLMode ? {} : { ssl: { rejectUnauthorized: false } }),
    max: 1 // Serverless should use minimal connections
  });
  db = drizzle(pool, { schema });
}

// ============ SUPABASE CLIENT FOR STORAGE ============

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Lazy initialization for Supabase client
let supabase: any = null;
let supabaseInitialized = false;

async function getSupabaseClient() {
  if (supabaseInitialized) return supabase;
  supabaseInitialized = true;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log("Supabase Storage not configured - SUPABASE_URL or SUPABASE_SERVICE_KEY missing");
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

app.get("/api/health", async (req, res) => {
  if (!pool) {
    return res.status(500).json({ status: "error", database: false, message: "DATABASE_URL not configured" });
  }
  try {
    await pool.query('SELECT 1');
    res.json({ status: "ok", database: true });
  } catch (error: any) {
    res.status(500).json({ status: "error", database: false, message: error.message });
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
    const [coupon] = await this.getDb().select().from(coupons).where(eq(coupons.code, code));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await this.getDb().insert(coupons).values(coupon).returning();
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
}

const storage = new DatabaseStorage();

// ============ EMAIL FUNCTION ============

async function sendOrderConfirmationEmail(order: any) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('RESEND_API_KEY not set, skipping email');
      return;
    }
    
    const resend = new Resend(apiKey);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://infinitehome.mv';
    const trackingUrl = `${baseUrl}/track?order=${order.orderNumber}`;

    const itemsHtml = order.items.map((item: any) => `
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

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #fcfaf7; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 40px 20px; text-align: center; background-color: #1a1a1a; color: #ffffff;">
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">INFINITE HOME</h1>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px;">Order Confirmation</h2>
            <p>Dear ${order.customerName},</p>
            <p>Thank you for your order. Order Number: <strong>${order.orderNumber}</strong></p>
            <p><a href="${trackingUrl}">Track Your Order</a></p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #1a1a1a;">
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 15px 10px; text-align: right; font-weight: bold;">Total</td>
                  <td style="padding: 15px 10px; text-align: right; font-weight: bold;">MVR ${order.total.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: 'INFINITE HOME <noreply@infinitehome.mv>',
      to: order.customerEmail,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: html,
    });
  } catch (error) {
    console.error('Error sending email:', error);
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
    const customer = await storage.createCustomer(data);
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
  if (customer && customer.password === password) {
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
  if (admin && admin.password === password) {
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
    const admin = await storage.createAdmin(data);
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
      let availableStock = product.stock || 0;
      
      if (variantStock && Object.keys(variantStock).length > 0) {
        if (variantStock[variantKey] !== undefined) {
          availableStock = variantStock[variantKey];
        } else {
          availableStock = 0;
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
        message: "Storage not configured - missing SUPABASE_URL or SUPABASE_SERVICE_KEY",
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
        message: "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables" 
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

// Serve object paths (redirect to Supabase Storage public URL)
app.get("/objects/*", (req, res) => {
  // For legacy paths, redirect to placeholder or return 404
  // New uploads use full Supabase URLs
  res.status(404).json({ error: "Object not found" });
});

// ============ VERCEL HANDLER ============

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
