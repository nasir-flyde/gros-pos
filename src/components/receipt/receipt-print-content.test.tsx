import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptPrintContent } from "./receipt-print-content";
import type { NormalizedReceipt } from "@/lib/receipt";

const receipt: NormalizedReceipt = {
  orderId: "ORD-1001",
  total: 255,
  itemsWithGst: [
    {
      productVariantId: "variant-1",
      variantName: "Extra Long Premium Basmati Rice Family Value Pack 5kg",
      sku: "1001-RICE",
      quantity: 2,
      unitPrice: 127.5,
      taxRate: 5,
      discountAmount: 0,
      lineTotal: 255,
      cgst: 6.07,
      sgst: 6.07,
      igst: 0,
      netPrice: 121.43,
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
    5: { taxable: 242.86, cgst: 6.07, sgst: 6.07, igst: 0 },
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
  totalIgst: 0,
  gstBuyer: null,
  totalGst: 12.14,
  taxableValue: 242.86,
  paymentRef: "UPI12345",
  delivery: "Walk-Out",
};

describe("ReceiptPrintContent", () => {
  it("prints B2B buyer and interstate tax details from the saved receipt", () => {
    render(
      <ReceiptPrintContent
        receipt={{
          ...receipt,
          gstBuyer: {
            gstin: "23AFOPS4000B1ZZ",
            pan: "AFOPS4000B",
            name: "Charanjeet Singh",
            flatDoorNo: "111",
            streetLocality: "Maxi Road",
            city: "Ujjain",
            state: "Madhya Pradesh",
            stateCode: "23",
            stateName: "Madhya Pradesh",
            pincode: "456010",
            taxType: "INTER",
          },
          itemsWithGst: [{ ...receipt.itemsWithGst[0], igst: 12.14, cgst: 0, sgst: 0 }],
          totalIgst: 12.14,
          totalCgst: 0,
          totalSgst: 0,
          gstByRate: { 5: { taxable: 242.86, cgst: 0, sgst: 0, igst: 12.14 } },
        }}
      />,
    );
    expect(screen.getByText("Original for Recipient")).toBeInTheDocument();
    expect(screen.getByText(/PAN: AFOPS4000B/)).toBeInTheDocument();
    expect(screen.getByText("HSN Code")).toBeInTheDocument();
    expect(screen.getByText("1001")).toBeInTheDocument();
    expect(screen.getByText(/IGST @ 5.00%/)).toBeInTheDocument();
    expect(screen.getByText("Gross Sales Value")).toBeInTheDocument();
  });
  it("renders weighted quantity in grams and identifies the per-KG rate", () => {
    render(
      <ReceiptPrintContent
        receipt={{
          ...receipt,
          itemsWithGst: [
            {
              ...receipt.itemsWithGst[0],
              quantity: 0.5,
              quantityUnit: "KG",
              unitPrice: 120,
              lineTotal: 60,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("500 g")).toBeInTheDocument();
    expect(screen.getByText("₹120.00/KG")).toBeInTheDocument();
  });

  it("renders the full long item name while keeping numeric columns visible", () => {
    render(<ReceiptPrintContent receipt={receipt} />);

    expect(
      screen.getByText("Extra Long Premium Basmati Rice Family Value Pack 5kg"),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("₹127.50")).toBeInTheDocument();
    expect(screen.getAllByText("₹255.00").length).toBeGreaterThan(0);
    expect(screen.getByText("HSN Code: 1001")).toBeInTheDocument();
  });
});
