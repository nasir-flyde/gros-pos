import { describe, expect, it } from "vitest";
import {
  buildCheckoutLine,
  buildCheckoutPayload,
  calculateCheckoutTotals,
  calculatePayloadTotal,
} from "./order-payload.ts";

describe("checkout pricing", () => {
  it.each([
    [120, 100, 2, 200],
    [100, 100, 1, 100],
    [100, 102, 1, 102],
    [43.5, 41.25, 3, 123.75],
  ])(
    "preserves displayed selling price for mrp=%s price=%s qty=%s",
    (mrp, price, qty, expected) => {
      const line = buildCheckoutLine({
        product: { _id: "variant-1", mrp, price },
        qty,
      });

      expect(line.unitPrice * qty - line.discountAmount).toBe(expected);
      expect(calculateCheckoutTotals([line]).grandTotal).toBe(expected);
    },
  );

  it("calculates multiple products, manual discount, and delivery like the backend", () => {
    const items = [
      buildCheckoutLine({ product: { _id: "a", mrp: 120, price: 100 }, qty: 2 }),
      buildCheckoutLine({ product: { _id: "b", mrp: 50, price: 45 }, qty: 1 }),
    ];

    expect(calculateCheckoutTotals(items, { delivery: 25, discount: 10 })).toMatchObject({
      subtotal: 290,
      catalogDiscount: 45,
      manualDiscount: 10,
      delivery: 25,
      grandTotal: 260,
    });
  });

  it("maps checkout values into API payload shape and exposes the represented total", () => {
    const payload = buildCheckoutPayload(
      [{ product: { _id: "variant-1", mrp: 52, price: 49, taxRate: 5 }, qty: 2 }],
      [{ paymentMode: "UPI", amount: 103 }],
      "Walk-Out",
      "store-1",
      "cashier-1",
      { delivery: 10, discount: 5, discountPercent: 2 },
      "customer-1",
    );

    expect(payload.items[0]).toEqual({
      productVariantId: "variant-1",
      quantity: 2,
      sellingMode: "FIXED",
      quantityUnit: "PCS",
      unitPrice: 52,
      taxRate: 5,
      discountAmount: 6,
    });
    expect(calculatePayloadTotal(payload)).toBe(103);
    expect(payload.payments[0].amount).toBe(103);
  });

  it("includes normalized weighted-sale metadata", () => {
    const line = buildCheckoutLine({
      product: {
        _id: "weighted-variant",
        mrp: 120,
        price: 120,
        sellingMode: "WEIGHT",
        unitType: "KG",
      },
      qty: 0.25,
      enteredQuantity: "250g",
    });

    expect(line).toMatchObject({
      productVariantId: "weighted-variant",
      quantity: 0.25,
      sellingMode: "WEIGHT",
      quantityUnit: "KG",
      enteredQuantity: "250g",
      unitPrice: 120,
      discountAmount: 0,
    });
    expect(calculateCheckoutTotals([line]).grandTotal).toBe(30);
  });

  it("submits the authoritative base price and markdown code", () => {
    const line = buildCheckoutLine({
      product: {
        _id: "variant-1",
        mrp: 120,
        basePrice: 100,
        price: 70,
        markdownCode: "MD0123456789ABCDEF0123",
      },
      qty: 2,
    });

    expect(line).toMatchObject({
      productVariantId: "variant-1",
      quantity: 2,
      unitPrice: 100,
      discountAmount: 60,
      markdownCode: "MD0123456789ABCDEF0123",
    });
    expect(calculateCheckoutTotals([line]).grandTotal).toBe(140);
  });
});
