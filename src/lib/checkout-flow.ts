import {
  buildCheckoutPayload,
  calculatePayloadTotal,
  roundCurrency,
  type CheckoutPayment,
  type CheckoutPayload,
} from "./order-payload";
import type { GstBuyer } from "./gst-billing";

export type PosPaymentSelection = "Cash" | "UPI" | "Card" | "Wallet" | "Split" | "Paytm POS";

export const buildSplitPaymentEntries = (
  splitPayments: Record<CheckoutPayment["paymentMode"], string>,
): CheckoutPayment[] =>
  Object.entries(splitPayments)
    .map(([paymentMode, amount]) => ({
      paymentMode: paymentMode as CheckoutPayment["paymentMode"],
      amount: roundCurrency(Number(amount || 0)),
    }))
    .filter((payment) => payment.amount > 0);

export const hasExactPaymentTotal = (payments: CheckoutPayment[], grandTotal: number) =>
  roundCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0)) ===
  roundCurrency(grandTotal);

export const getPayloadPaymentTotal = (payload: CheckoutPayload) =>
  roundCurrency(payload.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));

export const hasMatchingPayloadPaymentTotal = (payload: CheckoutPayload) =>
  getPayloadPaymentTotal(payload) === calculatePayloadTotal(payload);

export const resolveCheckoutPayments = (
  payment: PosPaymentSelection,
  grandTotal: number,
  splitPayments: Record<CheckoutPayment["paymentMode"], string>,
): CheckoutPayment[] => {
  if (payment === "Paytm POS") {
    return [];
  }
  if (payment === "Split") {
    return buildSplitPaymentEntries(splitPayments);
  }

  return [
    {
      paymentMode:
        payment.toUpperCase() === "CASH"
          ? "CASH"
          : (payment.toUpperCase() as CheckoutPayment["paymentMode"]),
      amount: roundCurrency(grandTotal),
    },
  ];
};

export interface BuildPosCheckoutPayloadArgs {
  cartItems: Array<{
    product: {
      _id: string;
      mrp: number;
      price: number;
      taxRate?: number;
      markdownCode?: string;
      basePrice?: number;
    };
    qty: number;
  }>;
  payment: PosPaymentSelection;
  grandTotal: number;
  splitPayments: Record<CheckoutPayment["paymentMode"], string>;
  deliveryType: "Home" | "Walk-Out";
  storeId: string;
  cashierId: string;
  charges: { delivery: number; discount: number; discountPercent?: number };
  customerId?: string;
  gstBill?: boolean;
  gstBuyer?: GstBuyer;
  couponCode?: string;
  orderId?: string;
  quoteVersion?: string | null;
}

export const buildPosCheckoutPayload = ({
  cartItems,
  payment,
  grandTotal,
  splitPayments,
  deliveryType,
  storeId,
  cashierId,
  charges,
  customerId,
  gstBill,
  gstBuyer,
  couponCode,
  orderId,
  quoteVersion,
}: BuildPosCheckoutPayloadArgs): CheckoutPayload => ({
  ...buildCheckoutPayload(
    cartItems,
    resolveCheckoutPayments(payment, grandTotal, splitPayments),
    deliveryType,
    storeId,
    cashierId,
    charges,
    customerId,
    orderId,
  ),
  ...(quoteVersion ? { quoteVersion } : {}),
  ...(couponCode ? { couponCode } : {}),
  ...(gstBill && gstBuyer ? { gstBill: true, gstBuyer } : {}),
});

export const buildPaytmPosRequestPayload = (
  args: Omit<BuildPosCheckoutPayloadArgs, "payment" | "splitPayments">,
): Omit<CheckoutPayload, "payments"> => {
  const payload = buildCheckoutPayload(
    args.cartItems,
    [],
    args.deliveryType,
    args.storeId,
    args.cashierId,
    args.charges,
    args.customerId,
    args.orderId,
  );
  const { payments: _payments, ...paytmPayload } = payload;
  return {
    ...paytmPayload,
    ...(args.gstBill && args.gstBuyer ? { gstBill: true, gstBuyer: args.gstBuyer } : {}),
    ...(args.quoteVersion ? { quoteVersion: args.quoteVersion } : {}),
    ...(args.couponCode ? { couponCode: args.couponCode } : {}),
  };
};
