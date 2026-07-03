import { describe, expect, it } from "vitest";
import {
  buildPosCheckoutPayload,
  hasExactPaymentTotal,
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
    expect(payload.items).toEqual([
      {
        productVariantId: "variant-1",
        quantity: 1,
        unitPrice: 120,
        taxRate: 5,
        discountAmount: 0,
      },
    ]);
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

  it("includes orderId when completing a resumed held order", () => {
    const payload = buildPosCheckoutPayload({
      cartItems: [{ product: { _id: "variant-2", mrp: 80, price: 80 }, qty: 2 }],
      payment: "UPI",
      grandTotal: 160,
      splitPayments: { CASH: "", UPI: "", CARD: "", WALLET: "" },
      deliveryType: "Walk-Out",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 0, discount: 0 },
      customerId: "customer-1",
      orderId: "order-123",
    });

    expect(payload.orderId).toBe("order-123");
  });

  it("sends catalog markdown as an item discount while keeping top-level discount for manual extras", () => {
    const payload = buildPosCheckoutPayload({
      cartItems: [{ product: { _id: "variant-3", mrp: 1200, price: 1078, taxRate: 5 }, qty: 1 }],
      payment: "Split",
      grandTotal: 1078,
      splitPayments: { CASH: "500", UPI: "578", CARD: "", WALLET: "" },
      deliveryType: "Walk-Out",
      storeId: "store-1",
      cashierId: "cashier-1",
      charges: { delivery: 0, discount: 0 },
    });

    expect(payload.discount).toBe(0);
    expect(payload.items[0]).toEqual({
      productVariantId: "variant-3",
      quantity: 1,
      unitPrice: 1200,
      taxRate: 5,
      discountAmount: 122,
    });
    expect(payload.payments).toEqual([
      { paymentMode: "CASH", amount: 500 },
      { paymentMode: "UPI", amount: 578 },
    ]);
  });
});
