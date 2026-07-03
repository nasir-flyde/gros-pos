import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAndPrintOrderReceipt, getNormalizedOrderReceipt } from "./order-receipt";
import { orderApi, type PosOrder } from "./order-api";
import { printNormalizedReceipt } from "./receipt-print";

vi.mock("./order-api", () => ({
  orderApi: {
    getReceipt: vi.fn(),
  },
}));

vi.mock("./receipt-print", () => ({
  printNormalizedReceipt: vi.fn(),
}));

const order: PosOrder = {
  _id: "order-object-1",
  orderNumber: "ORD-3003",
  orderType: "POS",
  storeId: { _id: "store-1", storeName: "Main Store", storeCode: "MS1" },
  customerId: { _id: "customer-1", name: "Asha", mobile: "9999999999" },
  status: "COMPLETED",
  subtotal: 100,
  tax: 0,
  discount: 0,
  delivery: 0,
  grandTotal: 100,
  paymentMode: "CASH",
  deliveryType: "WALK_OUT",
  createdAt: "2026-07-02T08:15:00.000Z",
  updatedAt: "2026-07-02T08:15:00.000Z",
};

describe("order receipt helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and normalizes a receipt for an order", async () => {
    vi.mocked(orderApi.getReceipt).mockResolvedValue({
      success: true,
      data: {
        receiptNumber: "RCPT-3003",
        paymentMode: "CASH",
      },
    } as never);

    const receipt = await getNormalizedOrderReceipt(order);

    expect(orderApi.getReceipt).toHaveBeenCalledWith("order-object-1");
    expect(receipt.invoiceNumber).toBe("RCPT-3003");
    expect(receipt.orderId).toBe("ORD-3003");
  });

  it("prints a fetched receipt", async () => {
    vi.mocked(orderApi.getReceipt).mockResolvedValue({
      success: true,
      data: {
        receiptNumber: "RCPT-3003",
      },
    } as never);
    vi.mocked(printNormalizedReceipt).mockResolvedValue(true);

    const printed = await fetchAndPrintOrderReceipt(order);

    expect(printNormalizedReceipt).toHaveBeenCalledTimes(1);
    expect(printed).toBe(true);
  });

  it("throws when the backend has no printable receipt", async () => {
    vi.mocked(orderApi.getReceipt).mockResolvedValue({
      success: true,
      data: null,
    } as never);

    await expect(fetchAndPrintOrderReceipt(order)).rejects.toThrow(
      "Receipt is not available for this order yet.",
    );
    expect(printNormalizedReceipt).not.toHaveBeenCalled();
  });
});
