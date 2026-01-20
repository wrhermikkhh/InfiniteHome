import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCouponSchema, insertOrderSchema, insertAdminSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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

  // ============ PRODUCTS ============
  app.get("/api/products", async (req, res) => {
    const products = await storage.getAllProducts();
    res.json(products);
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
      const orderNumber = `IH-${Math.floor(10000 + Math.random() * 90000)}`;
      const data = insertOrderSchema.parse({ ...req.body, orderNumber });
      const order = await storage.createOrder(data);
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
