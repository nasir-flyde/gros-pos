import type { CartItem, CartProduct } from "@/lib/cart-context";
import { getEffectiveVariantPrice, getPosImageUrl, type PosVariant } from "@/lib/product-api";
import type { MarkdownLabelResolution } from "@/lib/markdown-api";

export type ScannerCameraErrorName =
  | "NotAllowedError"
  | "NotFoundError"
  | "NotReadableError"
  | string
  | undefined;

export function normalizeBarcodeInput(value: string): string {
  return value.trim().toUpperCase();
}

export function getCameraErrorMessage(name: ScannerCameraErrorName): string {
  if (name === "NotAllowedError") {
    return "Camera permission denied. Allow camera access or type barcode manually.";
  }
  if (name === "NotFoundError") return "No camera found on this device.";
  if (name === "NotReadableError") return "Camera is already in use. Type barcode manually.";
  return "Could not access camera. Use manual barcode input.";
}

export function buildScannedCartProduct(variant: PosVariant): CartProduct {
  return {
    _id: variant._id,
    name: variant.variantName,
    weight: `${variant.unitValue} ${variant.unitType}`,
    mrp: variant.sellingMode === "WEIGHT" ? getEffectiveVariantPrice(variant) : (variant.mrp ?? 0),
    price: getEffectiveVariantPrice(variant),
    imageUrl: getPosImageUrl(variant),
    taxRate: variant.taxRate ?? 0,
    quantityAvailable: variant.quantityAvailable,
    sellingMode: variant.sellingMode,
    unitType: variant.unitType,
    unitValue: Number(variant.unitValue || 0) || undefined,
  };
}

export function buildMarkdownCartProduct(
  variant: PosVariant,
  markdown: MarkdownLabelResolution,
): CartProduct {
  return {
    _id: variant._id,
    lineKey: markdown.markdownCode,
    name: variant.variantName,
    weight: `${variant.unitValue} ${variant.unitType}`,
    mrp: markdown.basePrice,
    basePrice: markdown.basePrice,
    price: markdown.effectivePrice,
    imageUrl: getPosImageUrl(variant),
    taxRate: variant.taxRate ?? 0,
    quantityAvailable: markdown.remainingQuantity,
    remainingMarkdownQuantity: markdown.remainingQuantity,
    markdownCode: markdown.markdownCode,
    batchId: markdown.batchId,
    batchNumber: markdown.batchNumber,
    expiryDate: markdown.expiryDate,
    sellingMode: variant.sellingMode,
    unitType: variant.unitType,
    unitValue: Number(variant.unitValue || 0) || undefined,
  };
}

export function getScannerCartState(
  variant: PosVariant | null,
  items: CartItem[],
  lineKey?: string,
) {
  if (!variant) {
    return {
      cartLine: null,
      outOfStock: false,
      atStockLimit: false,
      canAdd: false,
      message: "",
    };
  }

  const cartLine =
    items.find((item) => (item.product.lineKey || item.product._id) === (lineKey || variant._id)) ??
    null;
  const available = variant.quantityAvailable;
  const outOfStock = available !== undefined && available <= 0;
  const atStockLimit = available !== undefined && cartLine !== null && cartLine.qty >= available;

  return {
    cartLine,
    outOfStock,
    atStockLimit,
    canAdd: !outOfStock && !atStockLimit,
    message: outOfStock
      ? "Product is out of stock."
      : atStockLimit
        ? `Only ${available ?? 0} available.`
        : "",
  };
}
