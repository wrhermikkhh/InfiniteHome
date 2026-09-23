import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { admins, orders, posTransactions, products } from "./schema";

/** Server-only commercial metadata; public product responses do not select this table. */
export const adminProductDetails = pgTable("admin_product_details", {
  productId: varchar("product_id").primaryKey().references(() => products.id),
  weightKg: numeric("weight_kg", { precision: 14, scale: 6 }),
  lengthCm: numeric("length_cm", { precision: 14, scale: 4 }),
  widthCm: numeric("width_cm", { precision: 14, scale: 4 }),
  heightCm: numeric("height_cm", { precision: 14, scale: 4 }),
  wholesaleCostMvr: numeric("wholesale_cost_mvr", { precision: 14, scale: 4 }),
  supplierCostMvr: numeric("supplier_cost_mvr", { precision: 14, scale: 4 }),
}, (table) => [
  check("admin_product_details_nonnegative_check", sql`
    (weight_kg IS NULL OR weight_kg >= 0)
    AND (length_cm IS NULL OR length_cm >= 0)
    AND (width_cm IS NULL OR width_cm >= 0)
    AND (height_cm IS NULL OR height_cm >= 0)
    AND (wholesale_cost_mvr IS NULL OR wholesale_cost_mvr >= 0)
    AND (supplier_cost_mvr IS NULL OR supplier_cost_mvr >= 0)
  `),
]);

export const productVariantCommercial = pgTable("product_variant_commercial", {
  productId: varchar("product_id").notNull().references(() => products.id),
  variantKey: text("variant_key").notNull(),
  sku: text("sku").unique(),
  usdPrice: numeric("usd_price", { precision: 14, scale: 4 }),
  wholesaleCostMvr: numeric("wholesale_cost_mvr", { precision: 14, scale: 4 }),
  supplierCostMvr: numeric("supplier_cost_mvr", { precision: 14, scale: 4 }),
}, (table) => [
  primaryKey({ columns: [table.productId, table.variantKey] }),
  check("product_variant_commercial_nonnegative_check", sql`
    (usd_price IS NULL OR usd_price >= 0)
    AND (wholesale_cost_mvr IS NULL OR wholesale_cost_mvr >= 0)
    AND (supplier_cost_mvr IS NULL OR supplier_cost_mvr >= 0)
  `),
]);

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  contact: text("contact"),
});

export const inventoryBatches = pgTable("inventory_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantKey: text("variant_key"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull().defaultNow(),
  quantityReceived: numeric("quantity_received", { precision: 14, scale: 4 }).notNull(),
  quantityRemaining: numeric("quantity_remaining", { precision: 14, scale: 4 }).notNull(),
  supplierCost: numeric("supplier_cost", { precision: 14, scale: 6 }).notNull(),
  costCurrency: text("cost_currency").notNull().default("MVR"),
  exchangeRate: numeric("exchange_rate", { precision: 14, scale: 6 }),
  unitLandedCostMvr: numeric("unit_landed_cost_mvr", { precision: 14, scale: 6 }).notNull(),
  reference: text("reference"),
  receiptKey: text("receipt_key").notNull().unique(),
  createdBy: varchar("created_by").notNull().references(() => admins.id),
}, (table) => [
  check("inventory_batches_quantity_check", sql`
    quantity_received > 0 AND quantity_remaining >= 0 AND quantity_remaining <= quantity_received
  `),
  check("inventory_batches_currency_check", sql`cost_currency IN ('MVR', 'USD')`),
  check("inventory_batches_cost_check", sql`
    supplier_cost >= 0 AND unit_landed_cost_mvr >= 0
    AND (cost_currency = 'MVR' OR exchange_rate IS NOT NULL AND exchange_rate > 0)
  `),
]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantKey: text("variant_key"),
  quantityDelta: numeric("quantity_delta", { precision: 14, scale: 4 }).notNull(),
  quantityBefore: numeric("quantity_before", { precision: 14, scale: 4 }).notNull(),
  quantityAfter: numeric("quantity_after", { precision: 14, scale: 4 }).notNull(),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  batchId: varchar("batch_id").references(() => inventoryBatches.id),
  reference: text("reference"),
  actorId: varchar("actor_id").notNull().references(() => admins.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("inventory_movements_balance_check", sql`
    quantity_before >= 0 AND quantity_after >= 0 AND quantity_delta = quantity_after - quantity_before
  `),
]);

export const saleCogsLines = pgTable("sale_cogs_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleKind: text("sale_kind").notNull(),
  saleId: varchar("sale_id").notNull(),
  lineIndex: integer("line_index").notNull(),
  batchId: varchar("batch_id").references(() => inventoryBatches.id),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
  unitCostMvr: numeric("unit_cost_mvr", { precision: 14, scale: 6 }).notNull(),
  totalCostMvr: numeric("total_cost_mvr", { precision: 14, scale: 6 }).notNull(),
  confidence: text("confidence").notNull(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sale_cogs_lines_sale_line_batch_nonnull_unique")
    .on(table.saleKind, table.saleId, table.lineIndex, table.batchId)
    .where(sql`batch_id IS NOT NULL`),
  uniqueIndex("sale_cogs_lines_sale_line_batch_null_unique")
    .on(table.saleKind, table.saleId, table.lineIndex)
    .where(sql`batch_id IS NULL`),
  check("sale_cogs_lines_kind_check", sql`sale_kind IN ('POS', 'ORDER')`),
  check("sale_cogs_lines_quantity_check", sql`quantity > 0 AND unit_cost_mvr >= 0 AND total_cost_mvr >= 0`),
  check("sale_cogs_lines_confidence_check", sql`confidence IN ('known', 'estimated', 'historical_unknown')`),
]);

export const accountingSettings = pgTable("accounting_settings", {
  id: integer("id").primaryKey().default(1),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  gstRate: numeric("gst_rate", { precision: 8, scale: 4 }).notNull().default("0"),
  tgstRate: numeric("tgst_rate", { precision: 8, scale: 4 }).notNull().default("0"),
  usdToMvrRate: numeric("usd_to_mvr_rate", { precision: 14, scale: 6 }).notNull().default("15.42"),
  costingMethod: text("costing_method").notNull().default("FIFO"),
  updatedBy: varchar("updated_by").references(() => admins.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("accounting_settings_singleton_check", sql`id = 1`),
  check("accounting_settings_rates_check", sql`gst_rate >= 0 AND tgst_rate >= 0 AND (usd_to_mvr_rate IS NULL OR usd_to_mvr_rate > 0)`),
  check("accounting_settings_costing_check", sql`costing_method IN ('FIFO', 'AVERAGE')`),
]);

export const posPaymentLines = pgTable("pos_payment_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  posId: varchar("pos_id").notNull().references(() => posTransactions.id),
  method: text("method").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  usdToMvrRate: numeric("usd_to_mvr_rate", { precision: 14, scale: 6 }),
  amountMvr: numeric("amount_mvr", { precision: 14, scale: 4 }).notNull(),
  feeMvr: numeric("fee_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("pos_payment_lines_currency_check", sql`currency IN ('MVR', 'USD')`),
  check("pos_payment_lines_amount_check", sql`amount > 0 AND amount_mvr > 0 AND fee_mvr >= 0`),
  check("pos_payment_lines_rate_check", sql`currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0`),
]);

export const posAccounting = pgTable("pos_accounting", {
  posId: varchar("pos_id").primaryKey().references(() => posTransactions.id),
  idempotencyKey: text("idempotency_key"),
  requestHash: text("request_hash"),
  taxType: text("tax_type").notNull().default("NONE"),
  taxableBaseMvr: numeric("taxable_base_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }).notNull().default("0"),
  taxAmountMvr: numeric("tax_amount_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  fxVarianceMvr: numeric("fx_variance_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("pos_accounting_tax_type_check", sql`tax_type IN ('NONE', 'GST', 'TGST')`),
  check("pos_accounting_amounts_check", sql`taxable_base_mvr >= 0 AND tax_rate >= 0 AND tax_amount_mvr >= 0`),
  uniqueIndex("pos_accounting_idempotency_key_idx").on(table.idempotencyKey).where(sql`idempotency_key IS NOT NULL`),
]);

export const manualOrderAccounting = pgTable("manual_order_accounting", {
  orderId: varchar("order_id").primaryKey().references(() => orders.id),
  idempotencyKey: text("idempotency_key"),
  requestHash: text("request_hash"),
  createdBy: varchar("created_by").notNull().references(() => admins.id),
  taxType: text("tax_type").notNull().default("NONE"),
  taxableBaseMvr: numeric("taxable_base_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 8, scale: 4 }).notNull().default("0"),
  taxAmountMvr: numeric("tax_amount_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  feeMvr: numeric("fee_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  fxVarianceMvr: numeric("fx_variance_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  statusSnapshot: text("status_snapshot").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("manual_order_accounting_tax_type_check", sql`tax_type IN ('NONE', 'GST', 'TGST')`),
  check("manual_order_accounting_amounts_check", sql`
    taxable_base_mvr >= 0 AND tax_rate >= 0 AND tax_amount_mvr >= 0 AND fee_mvr >= 0
  `),
  uniqueIndex("manual_order_accounting_idempotency_key_idx")
    .on(table.idempotencyKey)
    .where(sql`idempotency_key IS NOT NULL`),
]);

export const manualOrderPaymentLines = pgTable("manual_order_payment_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  method: text("method").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  usdToMvrRate: numeric("usd_to_mvr_rate", { precision: 14, scale: 6 }),
  amountMvr: numeric("amount_mvr", { precision: 14, scale: 4 }).notNull(),
  feeMvr: numeric("fee_mvr", { precision: 14, scale: 4 }).notNull().default("0"),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("manual_order_payment_lines_currency_check", sql`currency IN ('MVR', 'USD')`),
  check("manual_order_payment_lines_amount_check", sql`amount > 0 AND amount_mvr > 0 AND fee_mvr >= 0`),
  check("manual_order_payment_lines_rate_check", sql`
    currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0
  `),
]);

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
  currency: text("currency").notNull(),
  usdToMvrRate: numeric("usd_to_mvr_rate", { precision: 14, scale: 6 }),
  amountMvr: numeric("amount_mvr", { precision: 14, scale: 4 }).notNull(),
  isLanded: boolean("is_landed").notNull().default(false),
  batchId: varchar("batch_id").references(() => inventoryBatches.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
  actorId: varchar("actor_id").notNull().references(() => admins.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("expenses_currency_check", sql`currency IN ('MVR', 'USD')`),
  check("expenses_amount_check", sql`amount > 0 AND amount_mvr > 0`),
  check("expenses_rate_check", sql`currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0`),
  check("expenses_landed_link_check", sql`NOT is_landed OR batch_id IS NOT NULL`),
]);

export const accountingAudit = pgTable("accounting_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => admins.id),
  entityKind: text("entity_kind").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
