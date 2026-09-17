export interface CheckoutPayload {
  orderId?: string;
  storeId: string;
  cashierId: string;
  customerId?: string;
  items: CheckoutLine[];
  payments: CheckoutPayment[];
  deliveryType?: "HOME" | "PICKUP" | "WALK_OUT";
  discount?: number;
  discountPercent?: number;
  delivery?: number;
  quoteVersion?: string | null;
}

export interface CheckoutLine {
  productVariantId: string;
  quantity: number;
  sellingMode?: "FIXED" | "WEIGHT";
  quantityUnit?: "PCS" | "KG";
  enteredQuantity?: string;
  unitPrice: number;
  taxRate?: number;
  discountAmount: number;
  markdownCode?: string;
}

export interface CheckoutPayment {
  paymentMode: "CASH" | "UPI" | "CARD" | "WALLET";
  amount: number;
}

export interface CheckoutTotals {
  subtotal: number;
  catalogDiscount: number;
  manualDiscount: number;
  delivery: number;
  grandTotal: number;
}

const PAYMENT_MODE_MAP: Record<string, "CASH" | "UPI" | "CARD" | "WALLET"> = {
  Cash: "CASH",
  UPI: "UPI",
  Card: "CARD",
  Wallet: "WALLET",
  Split: "CASH",
};

const DELIVERY_TYPE_MAP: Record<string, "HOME" | "PICKUP" | "WALK_OUT"> = {
  Home: "HOME",
  Pickup: "PICKUP",
  "Walk-Out": "WALK_OUT",
};

export const roundCurrency = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function buildCheckoutLine(item: {
  product: {
    _id: string;
    mrp: number;
    price: number;
    taxRate?: number;
    markdownCode?: string;
    basePrice?: number;
    sellingMode?: "FIXED" | "WEIGHT";
    unitType?: string;
  };
  qty: number;
  enteredQuantity?: string;
}): CheckoutLine {
  const sellingPrice = roundCurrency(item.product.price);
  const mrp = roundCurrency(item.product.basePrice ?? item.product.mrp ?? sellingPrice);
  const unitPrice = roundCurrency(Math.max(mrp, sellingPrice));
  const discountAmount = roundCurrency((unitPrice - sellingPrice) * item.qty);

  return {
    productVariantId: item.product._id,
    quantity: item.qty,
    sellingMode: item.product.sellingMode || "FIXED",
    quantityUnit: item.product.sellingMode === "WEIGHT" ? "KG" : "PCS",
    ...(item.enteredQuantity ? { enteredQuantity: item.enteredQuantity } : {}),
    unitPrice,
    taxRate: item.product.taxRate,
    discountAmount,
    ...(item.product.markdownCode ? { markdownCode: item.product.markdownCode } : {}),
  };
}

export function calculateCheckoutTotals(
  items: Array<Pick<CheckoutLine, "unitPrice" | "quantity" | "discountAmount">>,
  charges: { delivery?: number; discount?: number } = {},
): CheckoutTotals {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0),
  );
  const catalogDiscount = roundCurrency(
    items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0),
  );
  const manualDiscount = roundCurrency(charges.discount ?? 0);
  const delivery = roundCurrency(charges.delivery ?? 0);
  const grandTotal = roundCurrency(subtotal + delivery - catalogDiscount - manualDiscount);

  return { subtotal, catalogDiscount, manualDiscount, delivery, grandTotal };
}

export function calculatePayloadTotal(
  payload: Pick<CheckoutPayload, "items" | "delivery" | "discount">,
) {
  return calculateCheckoutTotals(payload.items, {
    delivery: payload.delivery,
    discount: payload.discount,
  }).grandTotal;
}

export function buildCheckoutPayload(
  cartItems: Array<{
    product: {
      _id: string;
      mrp: number;
      price: number;
      taxRate?: number;
      markdownCode?: string;
      basePrice?: number;
      sellingMode?: "FIXED" | "WEIGHT";
      unitType?: string;
    };
    qty: number;
    enteredQuantity?: string;
  }>,
  payments: CheckoutPayment[],
  deliveryType: string,
  storeId: string,
  cashierId: string,
  charges: { delivery: number; discount: number; discountPercent?: number },
  customerId?: string,
  orderId?: string,
): CheckoutPayload {
  return {
    ...(orderId ? { orderId } : {}),
    storeId,
    cashierId,
    ...(customerId ? { customerId } : {}),
    items: cartItems.map(buildCheckoutLine),
    discount: roundCurrency(charges.discount),
    discountPercent: charges.discountPercent,
    delivery: roundCurrency(charges.delivery),
    payments: payments.map((payment) => ({
      paymentMode: PAYMENT_MODE_MAP[payment.paymentMode] ?? payment.paymentMode,
      amount: roundCurrency(payment.amount),
    })),
    deliveryType: DELIVERY_TYPE_MAP[deliveryType] ?? "WALK_OUT",
  };
}
