import { api } from "@/lib/api";

export interface RefundRecord {
  _id: string;
  orderId: string;
  refundNumber: string;
  refundAmount: number;
  refundMethod: "CASH" | "UPI" | "CARD" | "WALLET" | "STORE_CREDIT";
  status?: "PENDING" | "PROCESSED" | "FAILED";
  reason?: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const refundApi = {
  create: (payload: {
    orderId: string;
    refundAmount: number;
    refundMethod: "CASH" | "UPI" | "CARD" | "WALLET" | "STORE_CREDIT";
    reason?: string;
    items?: Array<{ orderItemId: string; quantity: number; amount: number }>;
  }) => api.post<unknown, ApiResponse<RefundRecord>>("/refunds", payload),

  getByOrderId: (orderId: string) =>
    api.get<unknown, ApiResponse<RefundRecord[]>>(`/refunds/order/${orderId}`),
};
