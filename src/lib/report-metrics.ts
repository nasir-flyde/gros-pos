import type { PosJoinedVariant } from "./product-api";
import type { FulfillmentStatus, OrderStatus, PosOrder } from "./order-api";

export type HourlySalesPoint = {
  hour: string;
  sales: number;
};

export type PaymentBreakdownPoint = {
  name: string;
  value: number;
};

export type StatusBreakdownPoint = {
  name: OrderStatus;
  value: number;
};

export type PaymentTotals = {
  cashCollected: number;
  onlinePayments: number;
};

export type InventoryAlertCounts = {
  criticalCount: number;
  lowCount: number;
  totalAlerts: number;
};

export type PendingFulfillmentCounts = {
  pendingDeliveries: number;
  pendingPickups: number;
};

const ONLINE_PAYMENT_MODES = new Set(["UPI", "CARD", "WALLET"]);
const CLOSED_ORDER_STATUSES = new Set(["COMPLETED", "CANCELLED", "REFUNDED"]);
const CLOSED_FULFILLMENT_STATUSES = new Set<FulfillmentStatus>(["DELIVERED", "CANCELLED", "FAILED"]);

export function buildHourlySales(orders: PosOrder[]): HourlySalesPoint[] {
  const buckets = new Map<string, number>();

  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours().toString().padStart(2, "0");
    buckets.set(hour, (buckets.get(hour) ?? 0) + order.grandTotal);
  }

  return Array.from({ length: 24 }, (_, index) => {
    const hour = index.toString().padStart(2, "0");
    return {
      hour,
      sales: buckets.get(hour) ?? 0,
    };
  });
}

export function buildPaymentBreakdown(orders: PosOrder[]): PaymentBreakdownPoint[] {
  const totals = new Map<string, number>();

  for (const order of orders) {
    const key = order.paymentMode || "UNKNOWN";
    totals.set(key, (totals.get(key) ?? 0) + order.grandTotal);
  }

  return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
}

export function buildStatusBreakdown(orders: PosOrder[]): StatusBreakdownPoint[] {
  const totals = new Map<OrderStatus, number>();

  for (const order of orders) {
    totals.set(order.status, (totals.get(order.status) ?? 0) + 1);
  }

  return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
}

export function buildCashMetrics(orders: PosOrder[]) {
  const totalSales = orders.reduce((sum, order) => sum + order.grandTotal, 0);
  const completedSales = orders
    .filter((order) => order.status === "COMPLETED")
    .reduce((sum, order) => sum + order.grandTotal, 0);
  const refunds = orders
    .filter((order) => order.status === "REFUNDED")
    .reduce((sum, order) => sum + order.grandTotal, 0);

  return {
    totalSales,
    completedSales,
    refunds,
    ordersCount: orders.length,
  };
}

export function buildPaymentTotals(orders: PosOrder[]): PaymentTotals {
  return orders.reduce(
    (totals, order) => {
      if (order.paymentMode === "CASH") {
        totals.cashCollected += order.grandTotal;
      } else if (ONLINE_PAYMENT_MODES.has(order.paymentMode)) {
        totals.onlinePayments += order.grandTotal;
      }
      return totals;
    },
    { cashCollected: 0, onlinePayments: 0 },
  );
}

export function buildAverageBasket(
  averageOrderValue: number | undefined,
  revenue: number,
  completedOrders: number,
) {
  if (typeof averageOrderValue === "number" && Number.isFinite(averageOrderValue) && averageOrderValue > 0) {
    return averageOrderValue;
  }

  if (completedOrders <= 0) {
    return 0;
  }

  return revenue / completedOrders;
}

export function buildInventoryAlertCounts(variants: PosJoinedVariant[]): InventoryAlertCounts {
  return variants.reduce(
    (counts, variant) => {
      const quantity = variant.quantityAvailable ?? 0;
      if (quantity < 10) {
        counts.criticalCount += 1;
      } else if (quantity < 20) {
        counts.lowCount += 1;
      }

      counts.totalAlerts = counts.criticalCount + counts.lowCount;
      return counts;
    },
    { criticalCount: 0, lowCount: 0, totalAlerts: 0 },
  );
}

function isPendingFulfillment(order: PosOrder) {
  if (CLOSED_ORDER_STATUSES.has(order.status)) {
    return false;
  }

  return order.fulfillmentStatus ? !CLOSED_FULFILLMENT_STATUSES.has(order.fulfillmentStatus) : true;
}

export function buildPendingFulfillmentCounts(orders: PosOrder[]): PendingFulfillmentCounts {
  return orders.reduce(
    (counts, order) => {
      if (!isPendingFulfillment(order)) {
        return counts;
      }

      if (order.deliveryType === "HOME") {
        counts.pendingDeliveries += 1;
      }

      if (order.deliveryType === "PICKUP") {
        counts.pendingPickups += 1;
      }

      return counts;
    },
    { pendingDeliveries: 0, pendingPickups: 0 },
  );
}
