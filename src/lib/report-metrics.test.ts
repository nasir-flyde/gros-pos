import { describe, expect, it } from "vitest";
import {
  buildAverageBasket,
  buildCashMetrics,
  buildHourlySales,
  buildInventoryAlertCounts,
  buildPaymentTotals,
  buildPaymentBreakdown,
  buildPendingFulfillmentCounts,
  buildStatusBreakdown,
} from "./report-metrics.ts";
import type { PosOrder } from "./order-api.ts";
import type { PosJoinedVariant } from "./product-api.ts";

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
    expect(buildPaymentBreakdown(baseOrders).find((point) => point.name === "CARD")?.value).toBe(
      200,
    );
    expect(buildStatusBreakdown(baseOrders).find((point) => point.name === "REFUNDED")?.value).toBe(
      1,
    );
  });

  it("separates cash and online payment totals", () => {
    expect(
      buildPaymentTotals([
        ...baseOrders,
        {
          ...baseOrders[0],
          _id: "3",
          orderNumber: "ORD-3",
          grandTotal: 150,
          paymentMode: "UPI",
        },
      ]),
    ).toEqual({
      cashCollected: 100,
      onlinePayments: 350,
    });
  });

  it("calculates average basket with safe fallback behavior", () => {
    expect(buildAverageBasket(240, 500, 2)).toBe(240);
    expect(buildAverageBasket(undefined, 756, 3)).toBe(252);
    expect(buildAverageBasket(undefined, 756, 0)).toBe(0);
  });

  it("counts critical and low stock inventory alerts", () => {
    const variants: PosJoinedVariant[] = [
      {
        _id: "v1",
        variantName: "A",
        productName: "A",
        categoryName: "Cat",
        categoryId: "cat",
        sku: "A",
        sellingMode: "FIXED",
        unitValue: "1",
        unitType: "pc",
        mrp: 10,
        price: 10,
        barcode: "1",
        barcodes: ["1"],
        taxRate: 0,
        quantityAvailable: 8,
      },
      {
        _id: "v2",
        variantName: "B",
        productName: "B",
        categoryName: "Cat",
        categoryId: "cat",
        sku: "B",
        sellingMode: "FIXED",
        unitValue: "1",
        unitType: "pc",
        mrp: 10,
        price: 10,
        barcode: "2",
        barcodes: ["2"],
        taxRate: 0,
        quantityAvailable: 15,
      },
      {
        _id: "v3",
        variantName: "C",
        productName: "C",
        categoryName: "Cat",
        categoryId: "cat",
        sku: "C",
        sellingMode: "FIXED",
        unitValue: "1",
        unitType: "pc",
        mrp: 10,
        price: 10,
        barcode: "3",
        barcodes: ["3"],
        taxRate: 0,
        quantityAvailable: 25,
      },
    ];

    expect(buildInventoryAlertCounts(variants)).toEqual({
      criticalCount: 1,
      lowCount: 1,
      totalAlerts: 2,
    });
  });

  it("uses configured reorder status for inventory alerts", () => {
    const variant: PosJoinedVariant = {
      _id: "configured",
      variantName: "Configured",
      productName: "Configured",
      categoryName: "Cat",
      categoryId: "cat",
      sku: "CONFIGURED",
      sellingMode: "FIXED",
      unitValue: "1",
      unitType: "pc",
      mrp: 10,
      price: 10,
      barcode: "4",
      barcodes: ["4"],
      taxRate: 0,
      quantityAvailable: 30,
      reorderThreshold: 40,
      stockStatus: "LOW",
    };

    expect(buildInventoryAlertCounts([variant])).toEqual({
      criticalCount: 0,
      lowCount: 1,
      totalAlerts: 1,
    });
  });

  it("counts only active pending delivery and pickup orders", () => {
    expect(
      buildPendingFulfillmentCounts([
        {
          ...baseOrders[0],
          _id: "delivery-1",
          orderNumber: "ORD-D1",
          status: "PLACED",
          deliveryType: "HOME",
          fulfillmentStatus: "OUT_FOR_DELIVERY",
        },
        {
          ...baseOrders[0],
          _id: "pickup-1",
          orderNumber: "ORD-P1",
          status: "PLACED",
          deliveryType: "PICKUP",
          fulfillmentStatus: "READY_FOR_PICKUP",
        },
        {
          ...baseOrders[0],
          _id: "delivery-2",
          orderNumber: "ORD-D2",
          status: "COMPLETED",
          deliveryType: "HOME",
          fulfillmentStatus: "DELIVERED",
        },
        {
          ...baseOrders[0],
          _id: "pickup-2",
          orderNumber: "ORD-P2",
          status: "REFUNDED",
          deliveryType: "PICKUP",
          fulfillmentStatus: "CANCELLED",
        },
      ]),
    ).toEqual({
      pendingDeliveries: 1,
      pendingPickups: 1,
    });
  });
});
