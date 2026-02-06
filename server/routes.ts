import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertCouponSchema, insertOrderSchema, insertAdminSchema, insertCustomerSchema, insertCustomerAddressSchema, insertCategorySchema, insertPosTransactionSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { sendOrderConfirmationEmail } from "./lib/email";
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
      const hashedPassword = await hashPassword(data.password);
      const admin = await storage.createAdmin({ ...data, password: hashedPassword });
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
      // Record initial status with timestamp in statusHistory
      const initialStatus = req.body.status || "pending";
      const data = insertOrderSchema.parse({ ...req.body, orderNumber, statusHistory: [{ status: initialStatus, timestamp: new Date().toISOString() }] });
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
      
      // Test log to verify order object
      console.log("Full order object for email:", JSON.stringify(order, null, 2));
      
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
      const { status } = req.body;
      
      // Get the current order to check previous status and items
      const currentOrder = await storage.getOrder(req.params.id);
      if (!currentOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const previousStatus = currentOrder.status;
      const order = await storage.updateOrderStatus(req.params.id, status);
      
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

      // Manually construct the transaction data to avoid drizzle-zod pattern issues
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
