import { buildCheckoutPayload, type CheckoutPayment, type CheckoutPayload } from "./order-payload";

export type PosPaymentSelection = "Cash" | "UPI" | "Card" | "Wallet" | "Split";

export const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const buildSplitPaymentEntries = (
  splitPayments: Record<CheckoutPayment["paymentMode"], string>,
): CheckoutPayment[] =>
  Object.entries(splitPayments)
    .map(([paymentMode, amount]) => ({
      paymentMode: paymentMode as CheckoutPayment["paymentMode"],
      amount: Number(amount || 0),
    }))
    .filter((payment) => payment.amount > 0);

export const hasExactPaymentTotal = (
  payments: CheckoutPayment[],
  grandTotal: number,
) => roundCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0)) === roundCurrency(grandTotal);

export const resolveCheckoutPayments = (
  payment: PosPaymentSelection,
  grandTotal: number,
  splitPayments: Record<CheckoutPayment["paymentMode"], string>,
): CheckoutPayment[] => {
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

interface BuildPosCheckoutPayloadArgs {
  cartItems: Array<{ product: { _id: string; mrp: number; price: number; taxRate?: number }; qty: number }>;
  payment: PosPaymentSelection;
  grandTotal: number;
  splitPayments: Record<CheckoutPayment["paymentMode"], string>;
  deliveryType: "Home" | "Walk-Out";
  storeId: string;
  cashierId: string;
  charges: { delivery: number; discount: number; discountPercent?: number };
  customerId?: string;
  orderId?: string;
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
  orderId,
}: BuildPosCheckoutPayloadArgs): CheckoutPayload =>
  buildCheckoutPayload(
    cartItems,
    resolveCheckoutPayments(payment, grandTotal, splitPayments),
    deliveryType,
    storeId,
    cashierId,
    charges,
    customerId,
    orderId,
  );
