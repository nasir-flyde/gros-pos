import { api } from "@/lib/api";

export interface ReplenishmentSuggestion {
  productVariantId: string;
  sku?: string;
  variantName?: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  settingId: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const storeOpsApi = {
  getReplenishmentSuggestions: (storeId: string) =>
    api.get<unknown, ApiResponse<ReplenishmentSuggestion[]>>(
      "/store-inventory/replenishment-suggestions",
      {
        params: { storeId },
      },
    ),

  listStoreInventory: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<any[]>>("/store-inventory/all", { params }),

  instantTransfer: (payload: {
    movementType: "STORE_TO_STORE";
    sourceType: "STORE";
    sourceId: string;
    destinationId: string;
    items: Array<{ productVariantId: string; quantity: number }>;
    remarks?: string;
  }) => api.post("/movements/instant-transfer", payload),
};
