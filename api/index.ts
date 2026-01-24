import express, { type Request, Response, NextFunction } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, ilike, or, sql } from "drizzle-orm";
import { Resend } from "resend";
import * as schema from "../shared/schema";
import {
  admins, customers, customerAddresses, categories, products, coupons, orders,
  insertProductSchema, insertCouponSchema, insertOrderSchema, insertAdminSchema, insertCustomerSchema, insertCustomerAddressSchema, insertCategorySchema,
  type Admin, type Customer, type CustomerAddress, type Category, type Product, type Coupon, type Order,
  type InsertAdmin, type InsertCustomer, type InsertCustomerAddress, type InsertCategory, type InsertProduct, type InsertCoupon, type InsertOrder
} from "../shared/schema";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

class DatabaseStorage {
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

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return updated || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  }

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
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  async updateProductStock(id: string, stock: number): Promise<Product | undefined> {
    const [updated] = await db.update(products).set({ stock }).where(eq(products.id, id)).returning();
    return updated || undefined;
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return await db.select().from(coupons);
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
    return coupon || undefined;
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [newCoupon] = await db.insert(coupons).values(coupon).returning();
    return newCoupon;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    await db.delete(coupons).where(eq(coupons.id, id));
    return true;
  }

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

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.customerEmail, email));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return await db.select().from(products).where(
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
      await db.update(products).set({ variantStock }).where(eq(products.id, productId));
    } else {
      const newStock = Math.max(0, (product.stock || 0) - quantity);
      await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }

  async restoreStock(productId: string, size: string, color: string, quantity: number): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) return;

    const variantStock = (product.variantStock as { [key: string]: number } | null) || {};
    const variantKey = `${size}-${color}`;

    if (variantStock[variantKey] !== undefined) {
      variantStock[variantKey] = variantStock[variantKey] + quantity;
      await db.update(products).set({ variantStock }).where(eq(products.id, productId));
    } else {
      const newStock = (product.stock || 0) + quantity;
      await db.update(products).set({ stock: newStock }).where(eq(products.id, productId));
    }
  }
}

const storage = new DatabaseStorage();

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

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
