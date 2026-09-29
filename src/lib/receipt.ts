import type { PosCartCustomer } from "./cart-context";
import type { PosOrder } from "./order-api";
import type { GstBuyer } from "./gst-billing";

export interface ReceiptLineItem {
  productVariantId?: string;
  variantName: string;
  sku: string;
  quantity: number;
  sellingMode?: "FIXED" | "WEIGHT";
  quantityUnit?: "PCS" | "KG";
  unitLabel?: string;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  lineTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  netPrice: number;
  hsnCode: string;
  markdownCode?: string;
  batchNumber?: string;
  basePrice?: number;
  markdownUnitPrice?: number;
}

export interface NormalizedReceipt {
  orderId: string;
  total: number;
  itemsWithGst: ReceiptLineItem[];
  payments: Array<Record<string, unknown>>;
  subtotal: number;
  discount: number;
  discountPercent: number;
  tax: number;
  deliveryCharge: number;
  grandTotal: number;
  paid: number;
  changeAmount: number;
  paymentMode: string;
  orderNumber: string;
  invoiceNumber: string;
  issuedAt?: string;
  cashierName: string;
  customerName: string;
  addressStr: string;
  cityLine: string;
  itemCount: number;
  totalQty: number;
  grossAmount: number;
  netSalesValue: number;
  gstByRate: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }>;
  gstBuyer:
    | (GstBuyer & { pan: string; stateCode: string; stateName: string; taxType: "INTRA" | "INTER" })
    | null;
  storeName: string;
  storePhone: string;
  storeCode: string;
  orgLegalName: string;
  orgGstin: string;
  fssaiLicense: string;
  cinNumber: string;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  taxableValue: number;
  paymentRef: string;
  delivery: "Home" | "Pickup" | "Walk-Out";
}

export type ReceiptStatus = "generated" | "unavailable" | "pending_fulfillment";

export type ReceiptFallback = {
  orderId: string;
  total: number;
  payment: string;
  delivery: "Home" | "Pickup" | "Walk-Out";
  customer: PosCartCustomer | null;
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => (typeof value === "number" ? value : fallback);

export const isReceiptPrintable = (status?: ReceiptStatus | null) => status === "generated";

export const mapOrderDeliveryLabel = (
  deliveryType?: PosOrder["deliveryType"],
): ReceiptFallback["delivery"] => {
  switch (deliveryType) {
    case "HOME":
      return "Home";
    case "PICKUP":
      return "Pickup";
    case "WALK_OUT":
    default:
      return "Walk-Out";
  }
};

export const buildReceiptFallbackFromOrder = (order: PosOrder): ReceiptFallback => ({
  orderId: order.orderNumber,
  total: order.grandTotal,
  payment: order.paymentMode,
  delivery: mapOrderDeliveryLabel(order.deliveryType),
  customer: order.customerId
    ? {
        _id: order.customerId._id,
        name: order.customerId.name,
        mobile: order.customerId.mobile,
      }
    : null,
});

export function normalizeReceiptData(
  rawReceiptData: Record<string, unknown> | null | undefined,
  fallback: ReceiptFallback,
): NormalizedReceipt | null {
  if (!rawReceiptData) return null;

  const root = asObject(rawReceiptData) ?? {};
  const nested = asObject(root.receiptData) ?? root;
  const storeInfo = asObject(nested.storeInfo) ?? asObject(root.storeInfo) ?? {};
  const storeAddress = asObject(storeInfo.address) ?? {};
  const orgInfo = asObject(nested.organizationInfo) ?? {};
  const gstBuyer = nested.saleType === "B2B" ? asObject(nested.gstBuyer) : null;
  const isInterState = gstBuyer?.taxType === "INTER";
  const payments =
    asArray(nested.payments).length > 0 ? asArray(nested.payments) : asArray(root.payments);
  const rawItems = asArray(nested.items).length > 0 ? asArray(nested.items) : asArray(root.items);

  const subtotal = asNumber(nested.subtotal, asNumber(root.subtotal, 0));
  const discount = asNumber(nested.discount, asNumber(root.discount, 0));
  const catalogDiscount = asNumber(nested.catalogDiscount, asNumber(root.catalogDiscount, 0));
  const manualDiscount = asNumber(nested.manualDiscount, asNumber(root.manualDiscount, 0));
  const discountPercent = asNumber(nested.discountPercent, asNumber(root.discountPercent, 0));
  const tax = asNumber(nested.tax, asNumber(root.tax, 0));
  const deliveryCharge = asNumber(nested.delivery, asNumber(root.delivery, 0));
  const grandTotal = asNumber(nested.grandTotal, asNumber(root.grandTotal, fallback.total));
  const paid = asNumber(nested.paid, asNumber(root.paid, fallback.total));
  const changeAmount = asNumber(nested.changeAmount, asNumber(root.changeAmount, 0));
  const orderNumber = asString(nested.orderNumber, asString(root.orderNumber, fallback.orderId));
  const invoiceNumber = asString(root.receiptNumber, orderNumber);
  const issuedAt = asString(root.generatedAt, asString(root.createdAt, ""));
  const cashierName = asString(nested.cashierName, asString(root.cashierName, ""));
  const customerName = gstBuyer
    ? asString(gstBuyer.name)
    : asString(nested.customerName, asString(root.customerName, fallback.customer?.name ?? ""));
  const paymentMode = asString(nested.paymentMode, asString(root.paymentMode, fallback.payment));
  const storeName = asString(storeInfo.storeName, "Store");
  const storePhone = asString(storeInfo.phone, "");
  const storeCode = asString(storeInfo.storeCode, "");
  const orgLegalName = asString(orgInfo.legalName, "");
  const orgGstin = asString(
    gstBuyer?.sellerGstin,
    asString(orgInfo.gstNumber, asString(storeInfo.gstNumber, "")),
  );
  const fssaiLicense = asString(orgInfo.fssaiLicense, asString(storeInfo.fssaiLicense, ""));
  const cinNumber = asString(orgInfo.cinNumber, asString(storeInfo.cinNumber, ""));

  const line1 = asString(storeAddress.line1, "");
  const line2 = asString(storeAddress.line2, "");
  const city = asString(storeAddress.city, "");
  const state = asString(storeAddress.state, "");
  const pincode = asString(storeAddress.pincode, "");
  const addressStr = [line1, line2].filter(Boolean).join(", ");
  const cityLine = [city, state, pincode].filter(Boolean).join(", ");

  const gstByRate: Record<number, { taxable: number; cgst: number; sgst: number; igst: number }> =
    {};
  const itemsWithGst: ReceiptLineItem[] = rawItems.map((entry, index) => {
    const item = asObject(entry) ?? {};
    const rate = asNumber(item.taxRate, 0);
    const lineTotal = asNumber(item.lineTotal, 0);
    const taxable =
      rate > 0 ? Math.round(((lineTotal * 100) / (100 + rate)) * 100) / 100 : lineTotal;
    const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
    const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
    const sgst = isInterState ? 0 : Math.round((totalTax - cgst) * 100) / 100;
    const igst = isInterState ? totalTax : 0;
    const sku = asString(item.sku, "");
    const hsnCode = asString(item.hsnCode, sku.split("-")[0] || "");

    if (!gstByRate[rate]) {
      gstByRate[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    gstByRate[rate].taxable += taxable;
    gstByRate[rate].cgst += cgst;
    gstByRate[rate].sgst += sgst;
    gstByRate[rate].igst += igst;

    return {
      productVariantId: asString(item.productVariantId, undefined),
      variantName: asString(item.variantName, `Item ${index + 1}`),
      sku,
      quantity: asNumber(item.quantity, 0),
      sellingMode: item.sellingMode === "WEIGHT" ? "WEIGHT" : "FIXED",
      quantityUnit: item.quantityUnit === "KG" ? "KG" : "PCS",
      unitLabel: asString(item.unitLabel, item.quantityUnit === "KG" ? "/KG" : ""),
      unitPrice: asNumber(item.unitPrice, 0),
      taxRate: rate,
      discountAmount: asNumber(item.discountAmount, 0),
      lineTotal,
      cgst,
      sgst,
      igst,
      netPrice: asNumber(item.quantity, 0)
        ? Math.round((taxable / asNumber(item.quantity, 1)) * 100) / 100
        : 0,
      hsnCode,
      markdownCode: asString(item.markdownCode, undefined),
      batchNumber: asString(item.batchNumber, undefined),
      basePrice: typeof item.basePrice === "number" ? item.basePrice : undefined,
      markdownUnitPrice:
        typeof item.markdownUnitPrice === "number" ? item.markdownUnitPrice : undefined,
    };
  });

  const itemCount = itemsWithGst.length;
  const totalQty = itemsWithGst.reduce((sum, item) => sum + item.quantity, 0);
  const grossAmount = itemsWithGst.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const netSalesValue = subtotal - discount;
  const totalCgst = Object.values(gstByRate).reduce((sum, item) => sum + item.cgst, 0);
  const totalSgst = Object.values(gstByRate).reduce((sum, item) => sum + item.sgst, 0);
  const totalIgst = Object.values(gstByRate).reduce((sum, item) => sum + item.igst, 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const taxableValue = Object.values(gstByRate).reduce((sum, item) => sum + item.taxable, 0);
  const firstPayment = asObject(payments[0]) ?? {};
  const paymentRefSource = firstPayment.referenceNumber ?? firstPayment._id;
  const paymentRef = paymentRefSource ? String(paymentRefSource).slice(-8) : "";
  const safeDiscountPercent = manualDiscount > 0 && catalogDiscount === 0 ? discountPercent : 0;

  return {
    orderId: fallback.orderId,
    total: fallback.total,
    itemsWithGst,
    payments: payments.map((payment) => asObject(payment) ?? {}),
    subtotal,
    discount,
    discountPercent: safeDiscountPercent,
    tax,
    deliveryCharge,
    grandTotal,
    paid,
    changeAmount,
    paymentMode,
    orderNumber,
    invoiceNumber,
    issuedAt,
    cashierName,
    customerName,
    addressStr,
    cityLine,
    itemCount,
    totalQty,
    grossAmount: Math.round(grossAmount * 100) / 100,
    netSalesValue: Math.round(netSalesValue * 100) / 100,
    gstByRate,
    gstBuyer: gstBuyer as NormalizedReceipt["gstBuyer"],
    storeName,
    storePhone,
    storeCode,
    orgLegalName,
    orgGstin,
    fssaiLicense,
    cinNumber,
    totalCgst: Math.round(totalCgst * 100) / 100,
    totalSgst: Math.round(totalSgst * 100) / 100,
    totalIgst: Math.round(totalIgst * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    taxableValue: Math.round(taxableValue * 100) / 100,
    paymentRef,
    delivery: fallback.delivery,
  };
}
