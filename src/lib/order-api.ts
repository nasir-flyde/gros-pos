import { api } from "@/lib/api";
import {
  buildCheckoutPayload,
  type CheckoutPayload,
  type CheckoutPayment,
} from "./order-payload";

export type OrderStatus =
  | "DRAFT"
  | "HOLD"
  | "PLACED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderType = "POS" | "ONLINE";
export type DeliveryType = "HOME" | "PICKUP" | "WALK_OUT";
export type FulfillmentStatus =
  | "RESERVED"
  | "PICKING"
  | "PACKED"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PARTIALLY_FULFILLED"
  | "FAILED"
  | "CANCELLED";
export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export interface StoreRef {
  _id: string;
  storeName: string;
  storeCode: string;
}

export interface CustomerRef {
  _id: string;
  name: string;
  mobile: string;
}

export interface CashierRef {
  _id: string;
  firstName: string;
  lastName: string;
}

export interface OrderItemVariantRef {
  _id: string;
  sku?: string;
  variantName?: string;
  unitType?: string;
}

export interface OrderItem {
  _id: string;
  productVariantId?: OrderItemVariantRef | string;
  batchId?: string | null;
  batchNumber?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
  lineTotal: number;
}

export interface PosOrder {
  _id: string;
  organizationId?: string;
  orderNumber: string;
  orderType: OrderType;
  storeId?: StoreRef;
  customerId?: CustomerRef | null;
  cashierId?: CashierRef;
  status: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  subtotal: number;
  tax: number;
  discount: number;
  delivery: number;
  grandTotal: number;
  paymentMode: string;
  deliveryType: DeliveryType;
  amountPaid?: number;
  amountRefunded?: number;
  isPartiallyFulfilled?: boolean;
  partialFulfillmentNote?: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface CheckoutResult {
  order: PosOrder;
  items: OrderItem[];
  payments: Array<Record<string, unknown>>;
  receipt: Record<string, unknown> | null;
  receiptStatus: "generated" | "unavailable" | "pending_fulfillment";
  receiptWarning?: string;
}

export interface OrderSummary {
  totalOrders: number;
  revenue: number;
  averageOrderValue: number;
  draftOrders: number;
  heldOrders: number;
  placedOrders?: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  homeDeliveryOrders: number;
  delayedCount: number;
  exceptionCount: number;
  attentionCount: number;
}

export interface OrderTracking {
  orderId: string;
  status: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  deliveryOrderStatus?: string;
  estimatedDeliveryAt?: string | null;
  actualDeliveryAt?: string | null;
  location?: {
    latitude?: number;
    longitude?: number;
    updatedAt?: string;
  } | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export const orderApi = {
  checkout: (payload: CheckoutPayload) =>
    api.post<unknown, ApiResponse<CheckoutResult>>("/pos/checkout", payload),

  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosOrder[]>>("/orders", { params }),

  getSummary: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<OrderSummary>>("/orders/summary", { params }),

  getById: (id: string) => api.get<unknown, ApiResponse<PosOrder>>(`/orders/${id}`),

  getTracking: (id: string) =>
    api.get<unknown, ApiResponse<OrderTracking>>(`/orders/${id}/tracking`),

  pickupConfirm: (id: string) =>
    api.post<unknown, ApiResponse<{ order: PosOrder; receipt: Record<string, unknown> | null; receiptStatus: string }>>(
      `/orders/${id}/pickup-confirm`,
      {},
    ),

  getReceipt: (orderId: string) =>
    api.get<unknown, ApiResponse<Record<string, unknown>>>(`/orders/${orderId}/receipt`),

  getReceiptHtml: (orderId: string) =>
    api.get<string>(`/orders/${orderId}/receipt/html`, { responseType: 'text' }),

  hold: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/hold`),

  resume: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/resume`),

  cancel: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/cancel`),

  buildPayload: (
    cartItems: Array<{ product: { _id: string; mrp: number; price: number; taxRate?: number }; qty: number }>,
    payments: CheckoutPayment[],
    deliveryType: string,
    storeId: string,
    cashierId: string,
    charges: { delivery: number; discount: number; discountPercent?: number },
    customerId?: string,
    orderId?: string,
  ): CheckoutPayload =>
    buildCheckoutPayload(
      cartItems,
      payments,
      deliveryType,
      storeId,
      cashierId,
      charges,
      customerId,
      orderId,
    ),
};

export type GrosOrder = PosOrder;
