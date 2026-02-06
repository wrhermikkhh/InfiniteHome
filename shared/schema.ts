import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Customer Addresses (Address Book)
export const customerAddresses = pgTable("customer_addresses", {
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

export const insertCustomerAddressSchema = createInsertSchema(customerAddresses).omit({ id: true, createdAt: true });
export type InsertCustomerAddress = z.infer<typeof insertCustomerAddressSchema>;
export type CustomerAddress = typeof customerAddresses.$inferSelect;

// Admin Users
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

// Categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Products
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  salePrice: real("sale_price"),
  salePercent: real("sale_percent"),
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
  maxOrderQty: integer("max_order_qty"),
  createdAt: timestamp("created_at").defaultNow(),
});

// POS Transactions
export const posTransactions = pgTable("pos_transactions", {
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

export const insertPosTransactionSchema = createInsertSchema(posTransactions).omit({ id: true, createdAt: true }).extend({
  cashierId: z.string().min(1),
  cashierName: z.string().min(1),
  transactionNumber: z.string().min(1),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    qty: z.number(),
    price: z.number(),
    color: z.string().optional(),
    size: z.string().optional()
  })),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InsertPosTransaction = z.infer<typeof insertPosTransactionSchema>;
export type PosTransaction = typeof posTransactions.$inferSelect;

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Coupons
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discount: real("discount").notNull(),
  type: text("type").notNull(), // "percentage" or "flat"
  status: text("status").notNull().default("active"),
  scope: text("scope").notNull().default("store"), // "store", "category", "product"
  allowedCategories: jsonb("allowed_categories").$type<string[]>().default([]),
  allowedProducts: jsonb("allowed_products").$type<string[]>().default([]),
  allowPreOrder: boolean("allow_pre_order").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true });
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

// Orders
export const orders = pgTable("orders", {
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
  paymentMethod: text("payment_method").notNull(), // "cod" or "bank"
  paymentSlip: text("payment_slip"), // URL to uploaded slip
  status: text("status").notNull().default("pending"),
  statusHistory: jsonb("status_history").$type<{ status: string; timestamp: string }[]>().default([]), // tracks all status changes with timestamps
  couponCode: text("coupon_code"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
