import { describe, expect, it } from "vitest";
import {
  buildCashMetrics,
  buildHourlySales,
  buildPaymentBreakdown,
  buildStatusBreakdown,
} from "./report-metrics.ts";
import type { PosOrder } from "./order-api.ts";

const baseOrders: PosOrder[] = [
  {
    _id: "1",
    organizationId: "org",
    orderNumber: "ORD-1",
    orderType: "POS",
    storeId: { _id: "store", storeName: "Store", storeCode: "S1" },
    cashierId: { _id: "cashier", firstName: "A", lastName: "B" },
    status: "COMPLETED",
    subtotal: 100,
    tax: 0,
    discount: 0,
    delivery: 0,
    grandTotal: 100,
    paymentMode: "CASH",
    deliveryType: "WALK_OUT",
    createdAt: "2026-07-02T08:15:00",
    updatedAt: "2026-07-02T08:15:00",
  },
  {
    _id: "2",
    organizationId: "org",
    orderNumber: "ORD-2",
    orderType: "POS",
    storeId: { _id: "store", storeName: "Store", storeCode: "S1" },
    cashierId: { _id: "cashier", firstName: "A", lastName: "B" },
    status: "REFUNDED",
    subtotal: 200,
    tax: 0,
    discount: 0,
    delivery: 0,
    grandTotal: 200,
    paymentMode: "CARD",
    deliveryType: "HOME",
    createdAt: "2026-07-02T09:30:00",
    updatedAt: "2026-07-02T09:30:00",
  },
];

describe("report metrics", () => {
  it("summarizes cash metrics from orders", () => {
    expect(buildCashMetrics(baseOrders)).toEqual({
      totalSales: 300,
      completedSales: 100,
      refunds: 200,
      ordersCount: 2,
    });
  });

  it("builds chartable datasets", () => {
    expect(buildHourlySales(baseOrders).find((point) => point.hour === "08")?.sales).toBe(100);
    expect(buildPaymentBreakdown(baseOrders).find((point) => point.name === "CARD")?.value).toBe(200);
    expect(buildStatusBreakdown(baseOrders).find((point) => point.name === "REFUNDED")?.value).toBe(1);
  });
});
