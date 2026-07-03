import { beforeEach, describe, expect, it, vi } from "vitest";
import { printNormalizedReceipt } from "./receipt-print";
import type { NormalizedReceipt } from "./receipt";

const receipt: NormalizedReceipt = {
  orderId: "ORD-1001",
  total: 255,
  itemsWithGst: [
    {
      productVariantId: "variant-1",
      variantName: "Basmati Rice",
      sku: "1001-RICE",
      quantity: 2,
      unitPrice: 127.5,
      taxRate: 5,
      discountAmount: 0,
      lineTotal: 255,
      cgst: 6.07,
      sgst: 6.07,
      hsnCode: "1001",
    },
  ],
  payments: [],
  subtotal: 255,
  discount: 0,
  discountPercent: 0,
  tax: 12.14,
  deliveryCharge: 0,
  grandTotal: 255,
  paid: 255,
  changeAmount: 0,
  paymentMode: "UPI",
  orderNumber: "ORD-1001",
  invoiceNumber: "INV-1001",
  cashierName: "Asha",
  customerName: "Neha",
  addressStr: "Main Road",
  cityLine: "Kolkata, West Bengal, 700001",
  itemCount: 1,
  totalQty: 2,
  grossAmount: 255,
  netSalesValue: 255,
  gstByRate: {
    5: { taxable: 242.86, cgst: 6.07, sgst: 6.07 },
  },
  storeName: "CHHOTA BAZAAR",
  storePhone: "9999999999",
  storeCode: "CB1",
  orgLegalName: "Chhota Bazaar Retail Pvt Ltd",
  orgGstin: "19ABCDE1234F1Z5",
  fssaiLicense: "12345678901234",
  cinNumber: "U12345WB2024PTC000001",
  totalCgst: 6.07,
  totalSgst: 6.07,
  totalGst: 12.14,
  taxableValue: 242.86,
  paymentRef: "UPI12345",
  delivery: "Walk-Out",
};

describe("printNormalizedReceipt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it("mounts receipt content before printing and cleans up after print", async () => {
    vi.spyOn(window, "print").mockImplementation(() => {
      const root = document.getElementById("pos-receipt-print-root");
      const content = root?.querySelector("[data-receipt-print-content]");

      expect(root).not.toBeNull();
      expect(content).not.toBeNull();
      expect(root?.textContent).toContain("CHHOTA BAZAAR");
      expect(root?.textContent).toContain("Basmati Rice");

      window.dispatchEvent(new Event("afterprint"));
    });

    await expect(printNormalizedReceipt(receipt)).resolves.toBe(true);

    expect(document.getElementById("pos-receipt-print-root")).toBeNull();
    expect(document.getElementById("pos-receipt-print-style")).toBeNull();
  });
});
