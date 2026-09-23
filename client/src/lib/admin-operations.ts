import type { Order } from "./api";

const normalized = (value?: string | null) => (value || "").trim().toLowerCase();

/** Delivery and order lifecycles are updated independently. */
export function isTerminalOrder(order: Order): boolean {
  return ["delivered", "cancelled", "canceled", "refunded"].includes(normalized(order.status)) ||
    normalized(order.deliveryStatus) === "delivered";
}

export type FulfillmentQueue = "exceptions" | "awaiting" | "transit";

/** Unconfirmed orders are not dispatch work; exceptions still need review. */
export function fulfillmentQueue(order: Order): FulfillmentQueue | null {
  if (isTerminalOrder(order)) return null;
  const delivery = normalized(order.deliveryStatus);
  const status = normalized(order.status);
  const ready = ["confirmed", "label_generated", "processing", "shipped", "in_transit", "out_for_delivery", "delivery_exception"].includes(status);
  if (!ready) return null;
  if (["failed", "delivery_exception"].includes(delivery) || status === "delivery_exception") return "exceptions";
  if (["out_for_delivery", "shipped", "in_transit"].includes(delivery) ||
    ["shipped", "in_transit", "out_for_delivery"].includes(status)) return "transit";
  if (!delivery || ["label_created", "processing"].includes(delivery)) return "awaiting";
  return "exceptions";
}