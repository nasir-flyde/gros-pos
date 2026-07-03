import { describe, expect, it } from "vitest";
import { buildCheckoutPayload } from "./order-payload.ts";

describe("buildCheckoutPayload", () => {
  it("maps checkout values into API payload shape", () => {
    const payload = buildCheckoutPayload(
      [
        {
          product: { _id: "variant-1", mrp: 52, price: 49, taxRate: 5 },
          qty: 2,
        },
      ],
      [{ paymentMode: "UPI", amount: 103 }],
      "Walk-Out",
      "store-1",
      "cashier-1",
      { delivery: 10, discount: 5, discountPercent: 2 },
      "customer-1",
    );

    expect(payload).toEqual({
      storeId: "store-1",
      cashierId: "cashier-1",
      customerId: "customer-1",
      items: [
        {
          productVariantId: "variant-1",
          quantity: 2,
          unitPrice: 52,
          taxRate: 5,
          discountAmount: 6,
        },
      ],
      discount: 5,
      discountPercent: 2,
      delivery: 10,
      payments: [{ paymentMode: "UPI", amount: 103 }],
      deliveryType: "WALK_OUT",
    });
  });
});
