import type { OrderStatus, PosOrder } from "./order-api";

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
