import { sql } from "drizzle-orm";
import { inventoryRows } from "./inventory.js";
import { mutateInventory, recordInventory } from "./legacy-inventory.js";

function cents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000000) throw new Error("Invalid catalog price");
  return Math.round(value * 100);
}
function text(value: unknown, label: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${label}`);
  return value.trim();
}
function cartItems(input: any): any[] {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw new Error("Invalid cart");
  for (const item of input.items) {
    if (!item || typeof item.productId !== "string" || !item.productId || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 100) {
      throw new Error("Invalid cart quantity or product");
    }
    if (item.isPreOrder !== undefined && typeof item.isPreOrder !== "boolean") throw new Error("Invalid pre-order selection");
  }
  return input.items;
}

// Catalog uses DB column names; neither browser money nor browser product
// descriptions/balance metadata are accepted. Amounts are calculated in cents.
export function calculateCatalogQuote(input: any, products: any[], coupon: any = null) {
  const cart = cartItems(input);
  const speed = input.shippingSpeed ?? "standard";
  if (!["male", "hulhumale", "boat"].includes(input.deliveryType) || !["standard", "express"].includes(speed)) throw new Error("Invalid delivery option");
  let subtotal = 0, shipping = 0, eligible = 0;
  const requested = new Map<string, number>();
  for (const item of cart) requested.set(item.productId, (requested.get(item.productId) || 0) + item.qty);
  const items = cart.map(item => {
    const p = products.find(p => p.id === item.productId);
    if (!p || p.show_on_storefront === false) throw new Error("Product is unavailable");
    if (p.max_order_qty && requested.get(p.id)! > p.max_order_qty) throw new Error("Maximum order quantity exceeded");
    const size = text(item.size || "Standard", "product size", 80);
    const color = text(item.color || "Default", "product color", 80);
    const variant = (p.variants || []).find((v: any) => v.size === size);
    if ((p.variants?.length && !variant) || (p.colors?.length && !p.colors.includes(color))) throw new Error("Invalid product option");
    const preOrder = item.isPreOrder === true;
    if (preOrder && (!p.is_pre_order || (p.pre_order_deadline && new Date().toISOString().slice(0, 10) >= p.pre_order_deadline))) throw new Error("Pre-order is unavailable");
    let price = variant ? variant.price : p.price;
    cents(price);
    if (p.is_on_sale) {
      if (p.sale_percent) {
        if (typeof p.sale_percent !== "number" || p.sale_percent < 0 || p.sale_percent > 100) throw new Error("Invalid catalog sale");
        price *= 1 - p.sale_percent / 100;
      } else if (p.sale_price && p.price > 0) {
        cents(p.sale_price);
        price *= p.sale_price / p.price;
      }
    }
    // Existing storefront uses a positive initial payment, otherwise its
    // calculated regular/variant sale price, for preorder deposits.
    if (preOrder) price = p.pre_order_initial_payment || price;
    const unit = cents(price);
    const fullPrice = preOrder ? cents(p.pre_order_price ?? p.price) : 0;
    if (preOrder && unit > fullPrice) throw new Error("Pre-order deposit exceeds its catalog total price");
    const amount = unit * item.qty;
    subtotal += amount;
    if (speed === "express" && input.deliveryType !== "boat") shipping += cents(p.express_charge || 0) * item.qty;
    if (coupon && (!preOrder || coupon.allow_pre_order) && (
      coupon.scope === "store" ||
      (coupon.scope === "category" && coupon.allowed_categories?.includes(p.category)) ||
      (coupon.scope === "product" && coupon.allowed_products?.includes(p.id))
    )) eligible += amount;
    return {
      productId: p.id, name: p.name, qty: item.qty, price: unit / 100, size, color, isPreOrder: preOrder,
      ...(preOrder ? { preOrderTotalPrice: fullPrice / 100, preOrderEta: p.pre_order_eta || null } : {}),
    };
  });
  let discount = 0;
  if (input.couponCode != null && input.couponCode !== "") {
    if (typeof input.couponCode !== "string" || !coupon || coupon.status !== "active" ||
      coupon.code !== input.couponCode.trim().toUpperCase() || !["flat", "percentage"].includes(coupon.type) ||
      !["store", "category", "product"].includes(coupon.scope)) throw new Error("Coupon is invalid or expired");
    if (!eligible) throw new Error("Coupon does not apply to this order");
    const value = cents(coupon.discount);
    if (coupon.type === "percentage" && value > 10000) throw new Error("Coupon percentage is invalid");
    discount = Math.min(eligible, coupon.type === "percentage" ? Math.round(eligible * value / 10000) : value);
  }
  return { items, subtotal: subtotal / 100, discount: discount / 100, shipping: shipping / 100,
    total: (subtotal - discount + shipping) / 100, couponCode: coupon?.code || null };
}

export function catalogOrderPayload(input: any, quote: ReturnType<typeof calculateCatalogQuote>) {
  if (!["cod", "bank"].includes(input.paymentMethod)) throw new Error("Use the dedicated checkout for this payment method");
  const status = input.paymentMethod === "bank" ? "payment_verification" : "pending";
  return {
    orderNumber: text(input.orderNumber, "order reference", 100),
    trackingNumber: text(input.trackingNumber, "tracking reference", 100),
    customerName: text(input.customerName, "customer name"),
    customerEmail: text(input.customerEmail, "customer email", 254),
    customerPhone: text(input.customerPhone, "customer phone", 80),
    shippingAddress: text(input.shippingAddress, "shipping address", 2000),
    deliveryType: input.deliveryType,
    ...(input.deliveryType === "boat" ? {
      boatName: text(input.boatName, "boat name"), boatNumber: text(input.boatNumber, "boat number", 80),
      boatLocation: text(input.boatLocation, "boat location"),
      boatAtollIsland: text(input.boatAtollIsland || input.customerAtollIsland, "boat atoll/island"),
    } : {}),
    notes: input.notes ? text(input.notes, "notes", 2000) : null,
    paymentSlip: input.paymentMethod === "bank" && input.paymentSlip ? text(input.paymentSlip, "payment slip", 2000) : null,
    paymentMethod: input.paymentMethod, status,
    statusHistory: [{ status, timestamp: new Date().toISOString() }],
    ...quote,
  };
}

// Quote, stock validation, deductions, order insertion and allocation journal
// are one transaction. Locks precede all catalog pricing and coupon reads.
export async function createCatalogOrder(db: any, input: any, insert: (tx: any, payload: any) => Promise<any>) {
  const items = cartItems(input);
  return db.transaction(async (tx: any) => {
    const products = [];
    for (const id of Array.from(new Set(items.map(i => i.productId))).sort()) {
      const p = inventoryRows(await tx.execute(sql`SELECT * FROM products WHERE id = ${id} FOR UPDATE`))[0];
      if (!p) throw new Error("Product is unavailable");
      products.push(p);
    }
    let coupon = null;
    if (input.couponCode != null && input.couponCode !== "") {
      const code = text(input.couponCode, "coupon code", 100).toUpperCase();
      coupon = inventoryRows(await tx.execute(sql`SELECT * FROM coupons WHERE code = ${code} FOR SHARE`))[0] || null;
    }
    const payload = catalogOrderPayload(input, calculateCatalogQuote(input, products, coupon));
    const allocations = await mutateInventory(tx, payload.items);
    const order = await insert(tx, payload);
    await recordInventory(tx, "order", order.id, allocations);
    return order;
  });
}