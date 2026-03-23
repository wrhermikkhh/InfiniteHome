import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCouponSchema, insertOrderSchema, insertAdminSchema, insertCustomerSchema, insertCustomerAddressSchema, insertCategorySchema, insertPosTransactionSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { sendOrderConfirmationEmail, sendOrderStatusEmail, sendOrderLabelEmail, sendPosLabelEmail } from "./lib/email";
import { hashPassword, comparePasswords } from "./auth";

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
    if (admin && await comparePasswords(password, admin.password)) {
      res.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions } });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.get("/api/admins", async (req, res) => {
    const admins = await storage.getAllAdmins();
    res.json(admins.map(a => ({ id: a.id, name: a.name, email: a.email, isSuperAdmin: a.isSuperAdmin, permissions: a.permissions })));
  });

  app.post("/api/admins", async (req, res) => {
    try {
      const data = insertAdminSchema.parse(req.body);
      const hashedPassword = await hashPassword(data.password);
      const admin = await storage.createAdmin({ ...data, password: hashedPassword });
      res.json({ id: admin.id, name: admin.name, email: admin.email, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admins/:id/permissions", async (req, res) => {
    try {
      const updated = await storage.updateAdmin(req.params.id, { permissions: req.body });
      if (!updated) return res.status(404).json({ message: "Admin not found" });
      res.json({ id: updated.id, name: updated.name, email: updated.email, isSuperAdmin: updated.isSuperAdmin, permissions: updated.permissions });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admins/:id/password", async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hashedPassword = await hashPassword(password);
      const updated = await storage.updateAdmin(req.params.id, { password: hashedPassword });
      if (!updated) return res.status(404).json({ message: "Admin not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admins/:id", async (req, res) => {
    try {
      await storage.deleteAdmin(req.params.id);
      res.json({ success: true });
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

  // Storefront products (only products visible to customers)
  app.get("/api/storefront/products", async (req, res) => {
    const products = await storage.getStorefrontProducts();
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
    const num = req.params.orderNumber;
    let order = await storage.getOrderByNumber(num);
    if (!order) order = await storage.getOrderByTrackingNumber(num);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  });

  app.get("/api/pos/track/:number", async (req, res) => {
    try {
      const num = req.params.number;
      let transaction = await storage.getPosTransactionByNumber(num);
      if (!transaction) {
        transaction = await storage.getPosTransactionByTrackingNumber(num);
      }
      if (transaction) {
        res.json(transaction);
      } else {
        res.status(404).json({ message: "Transaction not found" });
      }
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const items = req.body.items as { productId?: string; name: string; qty: number; price: number; color?: string; size?: string }[];
      
      // Validate that items exist
      if (!items || items.length === 0) {
        return res.status(400).json({ message: "No items in order" });
      }
      
      // Fetch all products once for validation
      const allProducts = await storage.getAllProducts();
      const productMap = new Map(allProducts.map(p => [p.id, p]));
      
      // Validate variant stock for each item
      const stockErrors: string[] = [];
      for (const item of items) {
        // Require productId for secure validation
        if (!item.productId) {
          stockErrors.push(`Product ID missing for "${item.name}"`);
          continue;
        }
        
        const product = productMap.get(item.productId);
        
        if (!product) {
          stockErrors.push(`Product "${item.name}" not found (ID: ${item.productId})`);
          continue;
        }
        
        // Validate size and color against product options
        const productColors = (product.colors as string[] | null) || [];
        const productVariants = (product.variants as { size: string; price: number }[] | null) || [];
        const productSizes = productVariants.map(v => v.size);
        
        const requestedColor = item.color || 'Default';
        const requestedSize = item.size || 'Standard';
        
        // Validate color if product has colors and requested is not Default
        if (productColors.length > 0 && requestedColor !== 'Default' && !productColors.includes(requestedColor)) {
          stockErrors.push(`Invalid color "${requestedColor}" for ${item.name}`);
          continue;
        }
        
        // Validate size if product has sizes and requested is not Standard
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
        } else {
          // Fallback to product's general stock if variantStock is empty
          availableStock = product.stock || 0;
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
      // Generate digits-only tracking number (same style as POS)
      const now = new Date();
      const trkDate = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const trkTime = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
      const trkSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const trackingNumber = `${trkDate}${trkTime}${trkSuffix}`;
      // Record initial status with timestamp in statusHistory
      const initialStatus = req.body.status || "pending";
      const data = insertOrderSchema.parse({ ...req.body, orderNumber, trackingNumber, statusHistory: [{ status: initialStatus, timestamp: new Date().toISOString() }] });
      const order = await storage.createOrder(data);
      console.log("Order created:", order.id, "Order Number:", order.orderNumber);
      
      // Deduct stock for each item in the order
      for (const item of items) {
        if (item.productId) {
          const size = item.size || 'Standard';
          const color = item.color || 'Default';
          await storage.deductStock(item.productId, size, color, item.qty);
          console.log(`Stock deducted: ${item.name} (${size}/${color}) x${item.qty}`);
        }
      }
      
      // Send confirmation email asynchronously
      sendOrderConfirmationEmail(order).catch(err => {
        console.error("Email delivery failed for order", order.orderNumber, ":", err);
      });
      
      res.json(order);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status, location } = req.body;
      
      // Get the current order to check previous status and items
      const currentOrder = await storage.getOrder(req.params.id);
      if (!currentOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const previousStatus = currentOrder.status;
      let order = await storage.updateOrderStatus(req.params.id, status, location);
      
      // Auto-create invoice when order is confirmed (only if not already invoiced)
      if (order && status === 'confirmed' && previousStatus !== 'confirmed' && !order.invoiceNumber) {
        const invoiceNumber = await storage.getNextInvoiceNumber();
        order = await storage.invoiceOrder(req.params.id, invoiceNumber) || order;
        console.log(`Invoice created for order ${order.orderNumber}: ${invoiceNumber}`);
      }

      if (order) {
        // Restore stock if order is being cancelled (and wasn't cancelled before)
        if (status === 'cancelled' && previousStatus !== 'cancelled') {
          const items = order.items as { productId?: string; name: string; qty: number; size?: string; color?: string }[];
          for (const item of items) {
            if (item.productId) {
              const size = item.size || 'Standard';
              const color = item.color || 'Default';
              await storage.restoreStock(item.productId, size, color, item.qty);
              console.log(`Stock restored: ${item.name} (${size}/${color}) x${item.qty}`);
            }
          }
        }
        
        // Send email notification for status change
        if (status !== previousStatus) {
          sendOrderStatusEmail(order, status).catch(err => {
            console.error("Failed to send status email:", err);
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

  // Update order admin note
  app.patch("/api/orders/:id/admin-note", async (req, res) => {
    try {
      const { adminNote } = req.body;
      const order = await storage.updateOrderAdminNote(req.params.id, adminNote ?? null);
      if (order) res.json(order);
      else res.status(404).json({ message: "Order not found" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update order delivery status (label_created, processing, out_for_delivery, delivered, failed)
  app.patch("/api/orders/:id/delivery-status", async (req, res) => {
    try {
      const { deliveryStatus, location } = req.body;
      const prevOrder = await storage.getOrder(req.params.id);
      const order = await storage.updateOrderDeliveryStatus(req.params.id, deliveryStatus, location);
      if (order) {
        // Send email for every delivery status change (only once per status)
        if (prevOrder?.deliveryStatus !== deliveryStatus) {
          sendOrderStatusEmail(order, deliveryStatus).catch(err => console.error('Delivery status email failed:', err));
        }
        res.json(order);
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Test email endpoint (for debugging)
  app.post("/api/email/test", async (req, res) => {
    try {
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ success: false, error: 'Email address required' });
      }
      
      const order = {
        orderNumber: 'TEST-' + Math.floor(Math.random() * 10000),
        customerName: 'Test Customer',
        customerEmail: to,
        items: [{ name: 'Test Product', qty: 1, price: 100 }],
        subtotal: 100,
        discount: 0,
        shipping: 0,
        total: 100,
        status: 'pending',
        shippingAddress: '123 Test St'
      };
      
      await sendOrderConfirmationEmail(order);
      res.json({ success: true, message: 'Test email triggered, check server logs' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============ POS SYSTEM ============
  app.get("/api/pos/transactions", async (req, res) => {
    const transactions = await storage.getAllPosTransactions();
    res.json(transactions);
  });

  app.get("/api/pos/transactions/today", async (req, res) => {
    const transactions = await storage.getTodayPosTransactions();
    res.json(transactions);
  });

  app.get("/api/pos/transactions/:id", async (req, res) => {
    const transaction = await storage.getPosTransaction(req.params.id);
    if (transaction) {
      res.json(transaction);
    } else {
      res.status(404).json({ message: "Transaction not found" });
    }
  });

  // Convert a POS transaction into a regular order for unified delivery tracking
  app.post("/api/pos/transactions/:id/convert-to-order", async (req, res) => {
    try {
      const tx = await storage.getPosTransaction(req.params.id);
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      if (tx.convertedToOrderId) return res.status(409).json({ message: "Already converted" });

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const orderNumber = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      const order = await storage.createOrder({
        orderNumber,
        trackingNumber: tx.trackingNumber || undefined,
        customerId: tx.customerId || undefined,
        customerName: tx.labelRecipientName || tx.customerName || "POS Customer",
        customerEmail: (tx as any).labelRecipientEmail || "",
        customerPhone: tx.labelPhone || tx.customerPhone || "",
        shippingAddress: tx.labelAddress || "",
        customerAtollIsland: undefined,
        deliveryType: tx.labelDeliveryType === "express" ? "express" : "male",
        items: tx.items as any,
        subtotal: tx.subtotal,
        discount: tx.discount ?? 0,
        shipping: 0,
        total: tx.total,
        paymentMethod: tx.paymentMethod as any,
        status: "confirmed",
        deliveryStatus: tx.deliveryStatus || undefined,
        statusHistory: [{ status: "confirmed", timestamp: new Date().toISOString() }],
        notes: tx.notes || undefined,
      } as any);

      await storage.markPosTransactionConverted(tx.id, order.id);

      res.json({ order, transaction: { ...tx, convertedToOrderId: order.id } });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
      const productMap = new Map(allProducts.map(p => [p.id, p]));
      
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

      // Generate clean tracking number from transaction number digits only
      const trackingNumber = transactionNumber.replace(/^POS-/, '').replace(/-/g, '');

      // Manually construct the transaction data to avoid drizzle-zod pattern issues
      const data = {
        transactionNumber,
        trackingNumber,
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
      const transaction = await storage.createPosTransaction(data as any);

      // Deduct stock for each item
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) continue;

        const size = item.size || (product.variants && product.variants.length > 0 ? product.variants[0].size : 'Standard');
        const color = item.color || (product.colors && product.colors.length > 0 ? product.colors[0] : 'Default');
        
        await storage.deductStock(item.productId, size, color, item.qty);
        console.log(`POS Stock deducted: ${item.name} (${size}/${color}) x${item.qty}`);
      }

      res.json(transaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/pos/transactions/:id", async (req, res) => {
    try {
      const prevTransaction = await storage.getPosTransaction(req.params.id);
      const transaction = await storage.updatePosTransaction(req.params.id, req.body);
      if (transaction) {
        // Send email when label is first created (deliveryStatus changes to label_created)
        if (
          req.body.deliveryStatus === 'label_created' &&
          prevTransaction?.deliveryStatus !== 'label_created'
        ) {
          sendPosLabelEmail(transaction).catch(err => console.error('POS label email failed:', err));
        }
        res.json(transaction);
      } else {
        res.status(404).json({ message: "Transaction not found" });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // POS Statistics
  app.get("/api/pos/stats/today", async (req, res) => {
    const transactions = await storage.getTodayPosTransactions();
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    
    const totalSales = completedTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTransactions = completedTransactions.length;
    const totalItems = completedTransactions.reduce((sum, t) => {
      const items = t.items as { qty: number }[];
      return sum + items.reduce((itemSum, item) => itemSum + item.qty, 0);
    }, 0);
    
    res.json({
      totalSales,
      totalTransactions,
      totalItems,
      averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0
    });
  });

  return httpServer;
}
