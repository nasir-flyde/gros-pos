import type { OrderItem, PosOrder } from "@/lib/order-api";
import type { PosJoinedVariant } from "@/lib/product-api";
import type { RefundRecord } from "@/lib/refund-api";

export function splitFulfillmentOrders(orders: PosOrder[]) {
  const fulfillmentOrders = orders.filter(
    (order) => order.deliveryType === "HOME" || order.deliveryType === "PICKUP",
  );

  return {
    pickupOrders: fulfillmentOrders.filter((order) => order.deliveryType === "PICKUP"),
    homeOrders: fulfillmentOrders.filter((order) => order.deliveryType === "HOME"),
  };
}

export function getRefundableItems(order?: PosOrder | null): OrderItem[] {
  return ((order?.items ?? []) as OrderItem[]).filter((item) => item.quantity > 0);
}

export function getRefundableAmount(items: OrderItem[], refunds: RefundRecord[]): number {
  const originalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const refundedAmount = refunds.reduce((sum, refund) => sum + refund.refundAmount, 0);
  return Math.max(0, originalAmount - refundedAmount);
}

export function clampTransferQuantity(value: number, available?: number): number {
  const safeValue = Number.isFinite(value) ? Math.floor(value) : 0;
  const safeAvailable = Math.max(0, Math.floor(available ?? 0));
  return Math.max(0, Math.min(safeValue, safeAvailable));
}

export function buildSelectedTransferItems(
  variants: PosJoinedVariant[],
  selected: Record<string, number>,
) {
  return variants
    .map((variant) => ({
      ...variant,
      quantity: clampTransferQuantity(selected[variant._id] ?? 0, variant.quantityAvailable),
    }))
    .filter((variant) => variant.quantity > 0);
}

export function buildTransferPayloadItems(
  variants: PosJoinedVariant[],
  selected: Record<string, number>,
) {
  return buildSelectedTransferItems(variants, selected).map((variant) => ({
    productVariantId: variant._id,
    quantity: variant.quantity,
  }));
}
