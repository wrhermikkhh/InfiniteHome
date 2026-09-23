import test from "node:test";
import assert from "node:assert/strict";
import type { Order } from "../client/src/lib/api";
import { fulfillmentQueue, isTerminalOrder } from "../client/src/lib/admin-operations";

const order = (status: string, deliveryStatus?: string): Order => ({
  id: "1", orderNumber: "A-1", customerName: "Buyer", customerEmail: "",
  customerPhone: "", shippingAddress: "", items: [], subtotal: 0, discount: 0,
  shipping: 0, total: 0, paymentMethod: "bank", status, deliveryStatus,
});

test("never dispatch unconfirmed orders, even without a delivery status", () => {
  for (const status of ["pending", "payment_verification", "payment_pending"]) {
    assert.equal(fulfillmentQueue(order(status)), null);
    assert.equal(fulfillmentQueue(order(status, "failed")), null);
  }
  assert.equal(fulfillmentQueue(order("confirmed")), "awaiting");
  assert.equal(fulfillmentQueue(order("label_generated", "label_created")), "awaiting");
  assert.equal(fulfillmentQueue(order("in_transit")), "transit");
});

test("delivery exceptions surface while both terminal lifecycle types are excluded", () => {
  assert.equal(fulfillmentQueue(order("confirmed", "failed")), "exceptions");
  assert.equal(fulfillmentQueue(order("delivery_exception")), "exceptions");
  for (const status of ["cancelled", "canceled", "refunded", "delivered"]) {
    assert.equal(isTerminalOrder(order(status)), true);
    assert.equal(fulfillmentQueue(order(status)), null);
  }
  const deliveryOnly = order("confirmed", "delivered");
  assert.equal(isTerminalOrder(deliveryOnly), true);
  assert.equal(fulfillmentQueue(deliveryOnly), null);
});