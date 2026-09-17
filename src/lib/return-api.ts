import { api } from "@/lib/api";

export type ReturnResolution =
  | "REFUND"
  | "SAME_ITEM_EXCHANGE"
  | "DIFFERENT_ITEM_EXCHANGE"
  | "STORE_CREDIT"
  | "FREE_REPLACEMENT";
export type RefundMethod = "CASH" | "UPI" | "CARD" | "WALLET" | "STORE_CREDIT";
export type ReturnDisposition = "SELLABLE" | "DAMAGED" | "EXPIRED" | "QUARANTINE";
export type ExchangePaymentMethod = "CASH" | "UPI" | "CARD";

export interface ReturnItemRecord {
  _id: string;
  orderItemId: string;
  requestedQuantity: number;
  approvedQuantity: number;
  amount: number;
  productVariant?: { sku?: string; variantName?: string };
  replacementProductVariant?: { sku?: string; variantName?: string };
}

export interface ReturnRecord {
  _id: string;
  returnNumber: string;
  orderId: string;
  status: string;
  resolutionType: ReturnResolution;
  refundMethod?: RefundMethod;
  refundAmount?: number;
  exchangeSubtotal?: number;
  priceDifference?: number;
  fulfillmentReference?: string;
  financialReference?: string;
  amountCollected?: number;
  collectionMethod?: ExchangePaymentMethod;
  collectionReference?: string;
  items: ReturnItemRecord[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const returnApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<ReturnRecord[]>>("/returns", { params }),

  create: (
    payload: {
      orderId: string;
      channel: "IN_STORE";
      issueType: "CUSTOMER_RETURN" | "SAME_ITEM_EXCHANGE";
      resolutionType: ReturnResolution;
      refundMethod?: RefundMethod;
      receiptVerified: boolean;
      reason: string;
      items: Array<{
        orderItemId: string;
        quantity: number;
        disposition: ReturnDisposition;
        replacementProductVariantId?: string;
        replacementQuantity?: number;
      }>;
    },
    idempotencyKey?: string,
  ) =>
    api.post<unknown, ApiResponse<ReturnRecord>>("/returns", payload, {
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),

  verify: (returnId: string, items: ReturnItemRecord[]) =>
    api.post<unknown, ApiResponse<ReturnRecord>>(`/returns/${returnId}/verify`, {
      items: items.map((item) => ({
        returnItemId: item._id,
        approvedQuantity: item.requestedQuantity,
      })),
    }),

  fulfill: (
    returnId: string,
    items: ReturnItemRecord[],
    disposition: ReturnDisposition,
    collection?: { paymentMode: ExchangePaymentMethod; referenceNumber?: string },
  ) =>
    api.post<unknown, ApiResponse<ReturnRecord>>(`/returns/${returnId}/fulfill`, {
      items: items.map((item) => ({ returnItemId: item._id, disposition })),
      collection,
    }),
};
