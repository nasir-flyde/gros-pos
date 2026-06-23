import { api } from "@/lib/api";

export interface PosOrder {
  _id: string;
  orderNumber: string;
  storeId?: { _id: string; storeName: string; storeCode: string };
  customerId?: { _id: string; name: string; mobile: string } | null;
  cashierId?: { _id: string; firstName: string; lastName: string };
  status: "DRAFT" | "HOLD" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  subtotal: number;
  tax: number;
  discount: number;
  delivery: number;
  grandTotal: number;
  paymentMode: string;
  deliveryType: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutPayload {
  storeId: string;
  cashierId: string;
  customerId?: string;
  items: Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
  payments: Array<{
    paymentMode: "CASH" | "UPI" | "CARD" | "WALLET";
    amount: number;
  }>;
  deliveryType?: "HOME" | "PICKUP" | "WALK_OUT";
  discount?: number;
  delivery?: number;
}

export interface CheckoutResult {
  order: PosOrder;
  items: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  receipt: Record<string, unknown>;
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

export const orderApi = {
  checkout: (payload: CheckoutPayload) =>
    api.post<unknown, ApiResponse<CheckoutResult>>("/pos/checkout", payload),

  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosOrder[]>>("/orders", { params }),

  getById: (id: string) => api.get<unknown, ApiResponse<PosOrder>>(`/orders/${id}`),

  getReceipt: (orderId: string) =>
    api.get<unknown, ApiResponse<Record<string, unknown>>>(`/orders/${orderId}/receipt`),

  hold: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/hold`),

  resume: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/resume`),

  cancel: (id: string) => api.patch<unknown, ApiResponse<PosOrder>>(`/orders/${id}/cancel`),

  buildPayload: (
    cartItems: Array<{ product: { _id: string; price: number; taxRate?: number }; qty: number }>,
    paymentMode: string,
    deliveryType: string,
    storeId: string,
    cashierId: string,
    charges: { delivery: number; discount: number; grandTotal: number },
    customerId?: string,
  ): CheckoutPayload => ({
    storeId,
    cashierId,
    ...(customerId ? { customerId } : {}),
    items: cartItems.map((i) => ({
      productVariantId: i.product._id,
      quantity: i.qty,
      unitPrice: i.product.price,
      taxRate: i.product.taxRate,
    })),
    discount: charges.discount,
    delivery: charges.delivery,
    payments: [
      {
        paymentMode: PAYMENT_MODE_MAP[paymentMode] ?? "CASH",
        amount: charges.grandTotal,
      },
    ],
    deliveryType: DELIVERY_TYPE_MAP[deliveryType] ?? "WALK_OUT",
  }),
};
