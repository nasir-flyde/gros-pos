import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateReceiptPdf } from "./receipt-pdf";

type TextCall = {
  text: string;
  x?: number;
  y?: number;
};

const { textCalls } = vi.hoisted(() => ({
  textCalls: [] as TextCall[],
}));

vi.mock("jspdf", () => ({
  default: class MockJsPDF {
    setFont = vi.fn();
    setFontSize = vi.fn();
    getTextWidth = (text: string) => text.length;
    setLineWidth = vi.fn();
    line = vi.fn();
    splitTextToSize = (text: string, width: number) => {
      const words = text.split(/\s+/);
      const maxChars = Math.max(10, Math.floor(width / 2.5));
      const lines: string[] = [];
      let current = "";

      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }

      if (current) {
        lines.push(current);
      }

      return lines;
    };
    text = (text: string, x?: number, y?: number) => {
      textCalls.push({ text, x, y });
    };
    output = vi.fn(() => new ArrayBuffer(8));
  },
}));

describe("generateReceiptPdf", () => {
  beforeEach(() => {
    textCalls.length = 0;
  });

  it("wraps long item names instead of cropping them", () => {
    generateReceiptPdf({
      storeName: "CHHOTA BAZAAR",
      addressStr: "Main Road",
      cityLine: "Kolkata, West Bengal, 700001",
      storePhone: "9999999999",
      storeCode: "CB1",
      orgLegalName: "Chhota Bazaar Retail Pvt Ltd",
      orgGstin: "19ABCDE1234F1Z5",
      fssaiLicense: "12345678901234",
      cinNumber: "U12345WB2024PTC000001",
      orgEmail: "support@example.com",
      invoiceNumber: "INV-1001",
      cashierName: "Asha",
      customerName: "Neha",
      itemCount: 2,
      totalQty: 3,
      grossAmount: 355,
      discount: 0,
      discountPercent: 0,
      netSalesValue: 355,
      grandTotal: 355,
      paymentMode: "UPI",
      paymentRef: "UPI12345",
      totalCgst: 8.45,
      totalSgst: 8.45,
      totalGst: 16.9,
      taxableValue: 338.1,
      gstByRate: {
        5: { taxable: 338.1, cgst: 8.45, sgst: 8.45 },
      },
      gstSlabs: [],
      itemsWithGst: [
        {
          variantName: "Extra Long Premium Basmati Rice Family Value Pack 5kg",
          sku: "1001-RICE",
          hsnCode: "1001",
          unitPrice: 255,
          quantity: 1,
          lineTotal: 255,
          taxRate: 5,
          cgst: 6.07,
          sgst: 6.07,
        },
        {
          variantName: "Rock Salt",
          sku: "1002-SALT",
          hsnCode: "1002",
          unitPrice: 100,
          quantity: 1,
          lineTotal: 100,
          taxRate: 5,
          cgst: 2.38,
          sgst: 2.38,
        },
      ],
      delivery: "Walk-Out",
      orderId: "ORD-1001",
      total: 355,
    });

    const wrappedNameLines = textCalls.filter(
      (call) =>
        call.text.includes("Extra Long Premium") ||
        call.text.includes("Basmati Rice") ||
        call.text.includes("Family Value") ||
        call.text.includes("Pack 5kg"),
    );

    expect(wrappedNameLines.length).toBeGreaterThan(1);
    expect(wrappedNameLines.some((call) => call.text.includes("Pack 5kg"))).toBe(true);
    expect(textCalls.some((call) => call.text.includes("HSN"))).toBe(false);
    expect(textCalls.some((call) => call.text.trim() === "1001")).toBe(false);

    const nextItemCall = textCalls.find((call) => call.text === "Rock Salt");
    const lastWrappedLine = wrappedNameLines.at(-1);

    expect(nextItemCall).toBeDefined();
    expect(lastWrappedLine).toBeDefined();
    expect(nextItemCall?.y ?? 0).toBeGreaterThan(lastWrappedLine?.y ?? 0);
  });
});
