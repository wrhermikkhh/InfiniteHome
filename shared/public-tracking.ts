import type { Order, PosTransaction } from "./schema.js";

type TrackingHistoryEntry = {
  status: string;
  timestamp: string;
  location?: string;
};

export type PublicOrderTracking = {
  orderNumber: string;
  trackingNumber: string | null;
  status: string;
  statusHistory: TrackingHistoryEntry[];
  deliveryStatus: string | null;
  deliveryStatusHistory: TrackingHistoryEntry[];
  createdAt: Date | null;
  itemCount: number;
};

export type PublicPosTracking = {
  transactionNumber: string;
  trackingNumber: string | null;
  deliveryStatus: string | null;
  deliveryStatusHistory: TrackingHistoryEntry[];
  createdAt: Date | null;
  itemCount: number;
};

export function toPublicOrderTracking(order: Order): PublicOrderTracking {
  return {
    orderNumber: order.orderNumber,
    trackingNumber: order.trackingNumber,
    status: order.status,
    statusHistory: order.statusHistory || [],
    deliveryStatus: order.deliveryStatus,
    deliveryStatusHistory: order.deliveryStatusHistory || [],
    createdAt: order.createdAt,
    itemCount: order.items.length,
  };
}

export function toPublicPosTracking(transaction: PosTransaction): PublicPosTracking {
  return {
    transactionNumber: transaction.transactionNumber,
    trackingNumber: transaction.trackingNumber,
    deliveryStatus: transaction.deliveryStatus,
    deliveryStatusHistory: transaction.deliveryStatusHistory || [],
    createdAt: transaction.createdAt,
    itemCount: transaction.items.length,
  };
}
