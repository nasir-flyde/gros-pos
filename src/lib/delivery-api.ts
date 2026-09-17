import { api } from "@/lib/api";
import type { DeliveryAgentRef } from "@/lib/order-api";

export type ManualDeliveryReason =
  | "SCANNER_UNAVAILABLE"
  | "CUSTOMER_CONFIRMED"
  | "THIRD_PARTY_CONFIRMED"
  | "OTHER";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const deliveryApi = {
  getEligibleAgents: (orderId: string) =>
    api.get<unknown, ApiResponse<DeliveryAgentRef[]>>("/delivery/agents/eligible", {
      params: { orderId },
    }),

  assignAgent: (orderId: string, deliveryAgentId: string) =>
    api.post<unknown, ApiResponse<Record<string, unknown>>>(
      `/delivery/orders/${orderId}/assign-agent`,
      { deliveryAgentId },
    ),

  assignThirdParty: (
    orderId: string,
    payload: { provider: string; trackingUrl: string; trackingId?: string },
  ) =>
    api.post<unknown, ApiResponse<Record<string, unknown>>>(
      `/delivery/orders/${orderId}/assign-third-party`,
      payload,
    ),

  manualPickup: (orderId: string, payload: { reason: ManualDeliveryReason; note: string }) =>
    api.post<unknown, ApiResponse<Record<string, unknown>>>(
      `/delivery/orders/${orderId}/manual-picked-up`,
      payload,
    ),

  manualDelivery: (orderId: string, payload: { reason: ManualDeliveryReason; note: string }) =>
    api.post<unknown, ApiResponse<Record<string, unknown>>>(
      `/delivery/orders/${orderId}/manual-delivered`,
      payload,
    ),
};
