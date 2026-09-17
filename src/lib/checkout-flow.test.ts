import { describe, expect, it } from "vitest";
import {
  buildPosCheckoutPayload,
  buildPaytmPosRequestPayload,
  getPayloadPaymentTotal,
  hasExactPaymentTotal,
  hasMatchingPayloadPaymentTotal,
  resolveCheckoutPayments,
} from "./checkout-flow";

describe("checkout flow helpers", () => {
  it("builds a single-payment payload", () => {
    const payload = buildPosCheckoutPayload({
      cartItems: [{ product: { _id: "variant-1", mrp: 120, price: 120, taxRate: 5 }, qty: 1 }],
      payment: "Card",
      grandTotal: 120,
      splitPayments: { CASH: "", UPI: "", CARD: "", WALLET: "" },
      deliveryType: "Walk-Out",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 0, discount: 0 },
    });
    expect(payload.payments).toEqual([{ paymentMode: "CARD", amount: 120 }]);
    expect(hasMatchingPayloadPaymentTotal(payload)).toBe(true);
  });

  it("validates split payments against the exact grand total", () => {
    const payments = resolveCheckoutPayments("Split", 250, {
      CASH: "100",
      UPI: "50",
      CARD: "100",
      WALLET: "",
    });
    expect(hasExactPaymentTotal(payments, 250)).toBe(true);
    expect(hasExactPaymentTotal(payments, 249.99)).toBe(false);
  });

  it("preserves the reported above-MRP edge case in payload and payment totals", () => {
    const payload = buildPosCheckoutPayload({
      cartItems: [{ product: { _id: "variant-edge", mrp: 100, price: 102 }, qty: 1 }],
      payment: "Cash",
      grandTotal: 102,
      splitPayments: { CASH: "", UPI: "", CARD: "", WALLET: "" },
      deliveryType: "Walk-Out",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 0, discount: 0 },
    });
    expect(payload.items[0]).toMatchObject({ unitPrice: 102, discountAmount: 0 });
    expect(getPayloadPaymentTotal(payload)).toBe(102);
    expect(hasMatchingPayloadPaymentTotal(payload)).toBe(true);
  });

  it("validates split payment with manual discount and delivery against payload total", () => {
    const payload = buildPosCheckoutPayload({
      cartItems: [
        { product: { _id: "a", mrp: 120, price: 100 }, qty: 2 },
        { product: { _id: "b", mrp: 50, price: 45 }, qty: 1 },
      ],
      payment: "Split",
      grandTotal: 260,
      splitPayments: { CASH: "100", UPI: "160", CARD: "", WALLET: "" },
      deliveryType: "Home",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 25, discount: 10 },
    });
    expect(hasMatchingPayloadPaymentTotal(payload)).toBe(true);
  });

  it("builds a Paytm device request without a client-controlled payment result", () => {
    const payload = buildPaytmPosRequestPayload({
      cartItems: [{ product: { _id: "variant-4", mrp: 250, price: 250 }, qty: 1 }],
      grandTotal: 250,
      deliveryType: "Walk-Out",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 0, discount: 0 },
    });

    expect(payload).not.toHaveProperty("payments");
    expect(payload.items).toEqual([
      expect.objectContaining({ productVariantId: "variant-4", quantity: 1 }),
    ]);
  });
});
