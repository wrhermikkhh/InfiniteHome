import test from "node:test";
import assert from "node:assert/strict";
import { toPublicOrderTracking, toPublicPosTracking } from "../shared/public-tracking";

const privateFields = [
  "shippingAddress", "customerName", "customerEmail", "customerPhone",
  "labelRecipientName", "labelAddress", "labelPhone", "notes", "adminNote",
  "items", "subtotal", "discount", "shipping", "total", "paymentMethod",
  "paymentSlip", "invoiceNumber",
];

function assertNoPrivateFields(value: Record<string, unknown>) {
  for (const field of privateFields) assert.equal(field in value, false, `${field} must not be public`);
}

test("public order tracking is status-only for unauthenticated or incorrect-owner requests", () => {
  const response = toPublicOrderTracking({
    orderNumber: "ECOM-100",
    trackingNumber: "TRACK-100",
    status: "shipped",
    statusHistory: [{ status: "shipped", timestamp: "2026-09-21T10:00:00Z" }],
    deliveryStatus: "out_for_delivery",
    deliveryStatusHistory: [{ status: "out_for_delivery", timestamp: "2026-09-21T11:00:00Z" }],
    createdAt: new Date("2026-09-20T10:00:00Z"),
    items: [{ name: "Private purchase", qty: 1, price: 500 }],
    shippingAddress: "Private address",
    customerName: "Private customer",
    customerEmail: "private@example.test",
    customerPhone: "7000000",
    adminNote: "Private note",
    total: 500,
  } as any);

  assert.deepEqual(response, {
    orderNumber: "ECOM-100",
    trackingNumber: "TRACK-100",
    status: "shipped",
    statusHistory: [{ status: "shipped", timestamp: "2026-09-21T10:00:00Z" }],
    deliveryStatus: "out_for_delivery",
    deliveryStatusHistory: [{ status: "out_for_delivery", timestamp: "2026-09-21T11:00:00Z" }],
    createdAt: new Date("2026-09-20T10:00:00Z"),
    itemCount: 1,
  });
  assertNoPrivateFields(response as unknown as Record<string, unknown>);
});

test("public POS tracking omits recipient, address, contact, items, notes and payment data", () => {
  const response = toPublicPosTracking({
    transactionNumber: "POS-100",
    trackingNumber: "TRACK-POS-100",
    deliveryStatus: "processing",
    deliveryStatusHistory: [{ status: "processing", timestamp: "2026-09-21T11:00:00Z" }],
    createdAt: new Date("2026-09-21T10:00:00Z"),
    items: [{ name: "Private purchase", qty: 2, price: 200 }],
    labelRecipientName: "Private recipient",
    labelAddress: "Private address",
    labelPhone: "7000000",
    notes: "Private note",
    total: 400,
  } as any);

  assert.equal(response.itemCount, 1);
  assert.equal(response.deliveryStatus, "processing");
  assertNoPrivateFields(response as unknown as Record<string, unknown>);
});
