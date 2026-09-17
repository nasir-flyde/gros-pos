import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { orderApi } from "./order-api";

describe("Paytm POS order API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("quotes the basket without payments and submits the returned quote version", () => {
    const quotePayload = {
      storeId: "store-1",
      cashierId: "cashier-1",
      items: [{ productVariantId: "variant-1", quantity: 1, unitPrice: 570, discountAmount: 0 }],
    };
    orderApi.quoteCheckout(quotePayload);
    expect(api.post).toHaveBeenCalledWith("/pos/quote", quotePayload);
    expect(quotePayload).not.toHaveProperty("payments");

    const checkoutPayload = {
      ...quotePayload,
      payments: [{ paymentMode: "CARD" as const, amount: 564.55 }],
      quoteVersion: "123456789012345678901234",
    };
    orderApi.checkout(checkoutPayload);
    expect(api.post).toHaveBeenCalledWith("/pos/checkout", checkoutPayload);
  });

  it("uses the Paytm request endpoint instead of normal checkout", () => {
    const payload = {
      storeId: "store-1",
      cashierId: "cashier-1",
      items: [{ productVariantId: "variant-1", quantity: 1, unitPrice: 100, discountAmount: 0 }],
    };

    orderApi.requestPaytmPosPayment(payload);

    expect(api.post).toHaveBeenCalledWith("/pos/paytm/request", payload);
    expect(api.post).not.toHaveBeenCalledWith("/pos/checkout", expect.anything());
  });

  it("polls status through the backend-owned Paytm transaction", () => {
    orderApi.getPaytmPosPaymentStatus("payment-1");

    expect(api.get).toHaveBeenCalledWith("/pos/paytm/payments/payment-1/status");
  });
});
