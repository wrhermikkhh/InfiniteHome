import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCouponSchema, insertOrderSchema, insertAdminSchema, insertCustomerSchema, insertCustomerAddressSchema, insertCategorySchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { sendOrderConfirmationEmail } from "./lib/email";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // ============ CUSTOMER AUTH ============
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

  // ============ CUSTOMER ADDRESSES ============
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

  // ============ ADMIN AUTH ============
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
    const admins = await storage.getAllAdmins();
    res.json(admins.map(a => ({ id: a.id, name: a.name, email: a.email })));
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

  // ============ CATEGORIES ============
  app.get("/api/categories", async (req, res) => {
    const categories = await storage.getAllCategories();
    res.json(categories);
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

  // ============ PRODUCTS ============
  app.get("/api/products", async (req, res) => {
    const products = await storage.getAllProducts();
    res.json(products);
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

  // ============ COUPONS ============
  app.get("/api/coupons", async (req, res) => {
    const coupons = await storage.getAllCoupons();
    res.json(coupons);
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

  // ============ ORDERS ============
  app.get("/api/orders", async (req, res) => {
    const orders = await storage.getAllOrders();
    res.json(orders);
  });

  app.get("/api/orders/customer/:email", async (req, res) => {
    const orders = await storage.getOrdersByEmail(req.params.email);
    res.json(orders);
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
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const randomId = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const orderNumber = randomId;
      const data = insertOrderSchema.parse({ ...req.body, orderNumber });
      const order = await storage.createOrder(data);
      
      // Send confirmation email asynchronously
      sendOrderConfirmationEmail(order).catch(err => console.error("Email delivery failed:", err));
      
      res.json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (order) {
        res.json(order);
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
