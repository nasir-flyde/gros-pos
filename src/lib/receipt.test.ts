import { describe, expect, it } from "vitest";
import { buildReceiptFallbackFromOrder, isReceiptPrintable, normalizeReceiptData } from "./receipt";
import type { PosOrder } from "./order-api";

describe("normalizeReceiptData", () => {
  it("builds a safe fallback receipt when only checkout basics are available", () => {
    const receipt = normalizeReceiptData(
      {},
      {
        orderId: "ORD-1001",
        total: 255,
        payment: "Split",
        delivery: "Walk-Out",
        customer: { _id: "customer-1", name: "Asha", mobile: "9999999999", area: "Central" },
      },
    );

    expect(receipt).toMatchObject({
      orderId: "ORD-1001",
      orderNumber: "ORD-1001",
      paymentMode: "Split",
      grandTotal: 255,
      customerName: "Asha",
    });
    expect(receipt?.itemsWithGst).toEqual([]);
  });

  it("normalizes fetched historical receipt data using order fallback fields", () => {
    const order: PosOrder = {
      _id: "order-object-1",
      orderNumber: "ORD-2002",
      orderType: "POS",
      storeId: { _id: "store-1", storeName: "Main Store", storeCode: "MS1" },
      customerId: { _id: "customer-1", name: "Neha", mobile: "9999999999" },
      status: "COMPLETED",
      subtotal: 180,
      tax: 20,
      discount: 0,
      delivery: 0,
      grandTotal: 200,
      paymentMode: "UPI",
      deliveryType: "WALK_OUT",
      createdAt: "2026-07-02T08:15:00.000Z",
      updatedAt: "2026-07-02T08:15:00.000Z",
    };

    const receipt = normalizeReceiptData(
      {
        receiptNumber: "RCPT-1",
        items: [
          {
            variantName: "Rice",
            sku: "1001-RICE",
            quantity: 2,
            unitPrice: 100,
            taxRate: 5,
            lineTotal: 200,
          },
        ],
      },
      buildReceiptFallbackFromOrder(order),
    );

    expect(receipt).toMatchObject({
      orderId: "ORD-2002",
      customerName: "Neha",
      paymentMode: "UPI",
      grandTotal: 200,
      invoiceNumber: "RCPT-1",
    });
    expect(receipt?.itemsWithGst).toHaveLength(1);
  });
});

describe("isReceiptPrintable", () => {
  it("only treats generated receipts as printable", () => {
    expect(isReceiptPrintable("generated")).toBe(true);
    expect(isReceiptPrintable("unavailable")).toBe(false);
    expect(isReceiptPrintable("pending_fulfillment")).toBe(false);
    expect(isReceiptPrintable(undefined)).toBe(false);
  });
});
