import { roundCurrency } from "@/lib/order-payload";

export type CheckoutPaymentId = "Cash" | "UPI" | "Card" | "Wallet" | "Paytm POS" | "Split";
export type PaytmUiState = "idle" | "waiting" | "stopped" | "failed";

export function deriveCheckoutTotals({
  afterDisc,
  homeDelivery,
  discountPct,
}: {
  afterDisc: number;
  homeDelivery: boolean;
  discountPct: number;
}) {
  const sellingSubtotal = afterDisc;
  const deliveryFee = homeDelivery ? (sellingSubtotal > 500 ? 0 : 30) : 0;
  const extraDiscount = sellingSubtotal > 0 ? Math.round((sellingSubtotal * discountPct) / 100) : 0;
  const grandTotal = sellingSubtotal + deliveryFee - extraDiscount;

  return {
    sellingSubtotal,
    deliveryFee,
    extraDiscount,
    grandTotal,
    roundedGrandTotal: roundCurrency(grandTotal),
  };
}

export function getPaytmStatusTitle(state: PaytmUiState): string {
  if (state === "failed") return "Paytm payment failed";
  if (state === "stopped") return "Paytm status checks paused";
  return "Waiting for Paytm device";
}

export function isCheckoutSubmitDisabled({
  isSubmitting,
  paytmRequestActive,
  payment,
  paytmState,
  hasValidSplit,
}: {
  isSubmitting: boolean;
  paytmRequestActive: boolean;
  payment: CheckoutPaymentId;
  paytmState: PaytmUiState;
  hasValidSplit: boolean;
}): boolean {
  if (isSubmitting || paytmRequestActive) return true;
  if (payment === "Paytm POS" && paytmState === "failed") return true;
  if (payment === "Split" && !hasValidSplit) return true;
  return false;
}
