export interface CheckoutPayload {
  orderId?: string;
  storeId: string;
  cashierId: string;
  customerId?: string;
  items: Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    discountAmount?: number;
  }>;
  payments: CheckoutPayment[];
  deliveryType?: "HOME" | "PICKUP" | "WALK_OUT";
  discount?: number;
  discountPercent?: number;
  delivery?: number;
}

export interface CheckoutPayment {
  paymentMode: "CASH" | "UPI" | "CARD" | "WALLET";
  amount: number;
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

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function buildCheckoutPayload(
  cartItems: Array<{ product: { _id: string; mrp: number; price: number; taxRate?: number }; qty: number }>,
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
    items: cartItems.map((item) => ({
      productVariantId: item.product._id,
      quantity: item.qty,
      unitPrice: item.product.mrp,
      taxRate: item.product.taxRate,
      discountAmount: roundCurrency(Math.max(0, item.product.mrp - item.product.price) * item.qty),
    })),
    discount: charges.discount,
    discountPercent: charges.discountPercent,
    delivery: charges.delivery,
    payments: payments.map((payment) => ({
      paymentMode: PAYMENT_MODE_MAP[payment.paymentMode] ?? payment.paymentMode,
      amount: payment.amount,
    })),
    deliveryType: DELIVERY_TYPE_MAP[deliveryType] ?? "WALK_OUT",
  };
}
