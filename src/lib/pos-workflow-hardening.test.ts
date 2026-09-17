import { describe, expect, it } from "vitest";
import { deriveCheckoutTotals, getPaytmStatusTitle, isCheckoutSubmitDisabled } from "./checkout-ui";
import { isCustomerBlocked, validateCustomerForm } from "./customer-flow";
import { getErrorMessage, resolvePosPageState } from "./pos-page-state";
import {
  buildMarkdownCartProduct,
  buildScannedCartProduct,
  getCameraErrorMessage,
  getScannerCartState,
  normalizeBarcodeInput,
} from "./scanner-flow";
import { getMarkdownErrorMessage, isMarkdownCode } from "./markdown-api";
import type { CartItem } from "./cart-context";
import type { PosVariant } from "./product-api";

const variant: PosVariant = {
  _id: "variant-1",
  productId: "product-1",
  sku: "SKU-1",
  variantName: "Atta 5kg",
  sellingMode: "FIXED",
  unitType: "kg",
  unitValue: "5",
  mrp: 320,
  pricePerUnit: 299,
  barcodes: [{ code: "890100", type: "EAN", isPrimary: true }],
  images: [{ url: "https://img.example/atta.png" }],
  active: true,
  taxRate: 5,
  quantityAvailable: 2,
};

describe("POS workflow hardening helpers", () => {
  it("resolves reusable page states and readable errors", () => {
    expect(resolvePosPageState({ isLoading: true, isError: false, hasData: false })).toBe(
      "loading",
    );
    expect(resolvePosPageState({ isLoading: false, isError: true, hasData: false })).toBe("error");
    expect(resolvePosPageState({ isLoading: false, isError: false, hasData: false })).toBe("empty");
    expect(getErrorMessage(new Error("Network down"), "Fallback")).toBe("Network down");
    expect(getErrorMessage({}, "Fallback")).toBe("Fallback");
  });

  it("validates customer creation and blocked status", () => {
    expect(isCustomerBlocked(" blocked ")).toBe(true);

    expect(
      validateCustomerForm({
        name: "",
        mobile: "123",
        address: "",
        area: "",
        pincode: "12",
      }).errors,
    ).toEqual({
      name: "Customer name is required.",
      mobile: "Enter a valid 10 digit mobile number.",
      pincode: "Enter a valid 6 digit pincode.",
    });

    expect(
      validateCustomerForm({
        name: " Asha Sharma ",
        mobile: "99999 99999",
        address: " Main Road ",
        area: " Central ",
        pincode: "110001",
      }).payload,
    ).toEqual({
      name: "Asha Sharma",
      mobile: "9999999999",
      address: "Main Road",
      area: "Central",
      pincode: "110001",
    });
  });

  it("derives scanner product eligibility and camera fallback messages", () => {
    expect(normalizeBarcodeInput("  ab12 ")).toBe("AB12");
    expect(getCameraErrorMessage("NotAllowedError")).toContain("permission denied");

    const line: CartItem = {
      product: {
        _id: "variant-1",
        name: "Atta 5kg",
        weight: "5 kg",
        mrp: 320,
        price: 299,
        taxRate: 5,
        quantityAvailable: 2,
      },
      qty: 2,
    };

    expect(getScannerCartState(variant, [line])).toMatchObject({
      outOfStock: false,
      atStockLimit: true,
      canAdd: false,
      message: "Only 2 available.",
    });

    expect(buildScannedCartProduct(variant)).toMatchObject({
      _id: "variant-1",
      name: "Atta 5kg",
      weight: "5 kg",
      price: 299,
      quantityAvailable: 2,
    });
  });

  it("builds batch-bound markdown cart lines and recognizes only generated codes", () => {
    const code = "MD0123456789ABCDEF0123";
    expect(isMarkdownCode(code)).toBe(true);
    expect(isMarkdownCode("MD123")).toBe(false);
    expect(
      buildMarkdownCartProduct(variant, {
        markdownCode: code,
        productVariantId: variant._id,
        batchId: "batch-1",
        batchNumber: "B-001",
        expiryDate: "2026-08-25T00:00:00.000Z",
        basePrice: 299,
        effectivePrice: 209,
        remainingQuantity: 4,
      }),
    ).toMatchObject({
      _id: variant._id,
      lineKey: code,
      markdownCode: code,
      batchId: "batch-1",
      price: 209,
      basePrice: 299,
      quantityAvailable: 4,
    });
    expect(getMarkdownErrorMessage({ code: "MARKDOWN_EXPIRED" })).toContain("expired");
  });

  it("derives checkout totals and submit guards", () => {
    expect(deriveCheckoutTotals({ afterDisc: 400, homeDelivery: true, discountPct: 10 })).toEqual({
      sellingSubtotal: 400,
      deliveryFee: 30,
      extraDiscount: 40,
      grandTotal: 390,
      roundedGrandTotal: 390,
    });
    expect(getPaytmStatusTitle("stopped")).toBe("Paytm status checks paused");
    expect(
      isCheckoutSubmitDisabled({
        isSubmitting: false,
        paytmRequestActive: false,
        payment: "Split",
        paytmState: "idle",
        hasValidSplit: false,
      }),
    ).toBe(true);
  });
});
