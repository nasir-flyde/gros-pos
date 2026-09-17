import { api } from "@/lib/api";
import { buildCheckoutPayload, type CheckoutPayload, type CheckoutPayment } from "./order-payload";

export type OrderStatus = "DRAFT" | "HOLD" | "PLACED" | "COMPLETED" | "CANCELLED" | "REFUNDED";

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
export type PaymentStatus = "PENDING" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "FAILED";

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
  sellingMode?: "FIXED" | "WEIGHT";
  quantityUnit?: "PCS" | "KG";
  unitLabel?: string;
  enteredQuantity?: string;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
  lineTotal: number;
  markdownCode?: string;
  markdownCampaignId?: string | null;
  basePrice?: number;
  markdownUnitPrice?: number;
  markdownDiscount?: number;
  purchaseCost?: number;
  grossProfit?: number;
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

export type DeliveryMode = "IN_HOUSE" | "THIRD_PARTY";
export type DeliveryOrderStatus =
  | "ASSIGNED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "REATTEMPT_SCHEDULED";

export interface DeliveryAgentRef {
  _id: string;
  agentCode: string;
  firstName: string;
  lastName?: string;
  phone: string;
  currentStatus: "AVAILABLE" | "ON_DELIVERY" | "OFF_DUTY" | "INACTIVE";
  vehicleType: string;
}

export interface DeliveryAssignment {
  deliveryOrderId: string;
  mode: DeliveryMode;
  status: DeliveryOrderStatus;
  assignedAt?: string | null;
  assignedBy?: { _id: string; firstName: string; lastName?: string } | null;
  deliveryAgent?: DeliveryAgentRef | null;
  thirdPartyProvider?: string | null;
  thirdPartyTrackingId?: string | null;
  thirdPartyTrackingUrl?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  pickupUpdateMethod?: string | null;
  pickupManualReason?: string | null;
  pickupManualNote?: string | null;
  deliveryUpdateMethod?: string | null;
  deliveryManualReason?: string | null;
  deliveryManualNote?: string | null;
}

export interface StoreDeliveryOrder extends PosOrder {
  isDeliveryAssignable: boolean;
  deliveryAssignment: DeliveryAssignment | null;
  deliveryAddressSnapshot?: {
    label?: string;
    line1?: string;
    line2?: string;
    landmark?: string;
    phone?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

export interface CheckoutResult {
  order: PosOrder;
  items: OrderItem[];
  payments: Array<Record<string, unknown>>;
  receipt: Record<string, unknown> | null;
  receiptStatus: "generated" | "unavailable" | "pending_fulfillment";
  receiptWarning?: string;
}

export interface PosQuoteResult {
  items: CheckoutPayload["items"];
  totals: {
    subtotal: number;
    tax: number;
    catalogDiscount: number;
    manualDiscount: number;
    discount: number;
    discountPercent: number;
    delivery: number;
    grandTotal: number;
  };
  appliedOffers: Array<{
    promotionId: string;
    name?: string;
    promotionType?: string;
    discountAmount: number;
  }>;
  coupon: Record<string, unknown> | null;
  couponDecision: Record<string, unknown>;
  quoteVersion: string | null;
}

export interface PaytmPosRequestResult {
  paymentTransactionId: string;
  merchantTransactionId: string;
  orderId: string;
  status: "REQUEST_ACCEPTED" | "PENDING";
  message: string;
}

export interface PaytmPosStatusResult {
  status: "PENDING" | "COMPLETED" | "FAILED";
  message: string;
  checkout?: CheckoutResult;
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
  deliveryMode?: DeliveryMode;
  thirdPartyProvider?: string | null;
  thirdPartyTrackingId?: string | null;
  thirdPartyTrackingUrl?: string | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  pickupUpdateMethod?: string | null;
  pickupManualReason?: string | null;
  pickupManualNote?: string | null;
  deliveryUpdateMethod?: string | null;
  deliveryManualReason?: string | null;
  deliveryManualNote?: string | null;
  location?: {
    latitude?: number;
    longitude?: number;
    updatedAt?: string;
  } | null;
}

export interface CloseCounterResult {
  organizationId?: string | null;
  storeId: string;
  businessDate: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  closedBy?: string;
  closedAt: string;
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
  quoteCheckout: (payload: Omit<CheckoutPayload, "payments">) =>
    api.post<unknown, ApiResponse<PosQuoteResult>>("/pos/quote", payload),

  checkout: (payload: CheckoutPayload) =>
    api.post<unknown, ApiResponse<CheckoutResult>>("/pos/checkout", payload),

  requestPaytmPosPayment: (payload: Omit<CheckoutPayload, "payments">) =>
    api.post<unknown, ApiResponse<PaytmPosRequestResult>>("/pos/paytm/request", payload),

  getPaytmPosPaymentStatus: (paymentTransactionId: string) =>
    api.get<unknown, ApiResponse<PaytmPosStatusResult>>(
      `/pos/paytm/payments/${paymentTransactionId}/status`,
    ),

  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosOrder[]>>("/orders", { params }),

  listStoreDeliveries: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<StoreDeliveryOrder[]>>("/orders/store", { params }),

  getSummary: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<OrderSummary>>("/orders/summary", { params }),

  getById: (id: string) => api.get<unknown, ApiResponse<PosOrder>>(`/orders/${id}`),

  getTracking: (id: string) =>
    api.get<unknown, ApiResponse<OrderTracking>>(`/orders/${id}/tracking`),

  closeCounter: (payload: {
    storeId: string;
    businessDate: string;
    expectedAmount: number;
    actualAmount: number;
    variance: number;
  }) => api.post<unknown, ApiResponse<CloseCounterResult>>("/pos/close-counter", payload),

  pickupConfirm: (id: string) =>
    api.post<
      unknown,
      ApiResponse<{
        order: PosOrder;
        receipt: Record<string, unknown> | null;
        receiptStatus: string;
      }>
    >(`/orders/${id}/pickup-confirm`, {}),

  getReceipt: (orderId: string) =>
    api.get<unknown, ApiResponse<Record<string, unknown>>>(`/orders/${orderId}/receipt`),

  getReceiptHtml: (orderId: string) =>
    api.get<unknown, string>(`/orders/${orderId}/receipt/html`, { responseType: "text" }),

  hold: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/hold`),

  resume: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/resume`),

  cancel: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/cancel`),

  buildPayload: (
    cartItems: Array<{
      product: { _id: string; mrp: number; price: number; taxRate?: number };
      qty: number;
    }>,
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
