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

export interface StoreInventoryRecord {
  _id: string;
  storeId: string | { _id: string; storeName?: string; storeCode?: string };
  productVariantId: string | { _id: string; sku?: string; variantName?: string; unitType?: string };
  currentStock: number;
  reservedStock?: number;
  availableStock?: number;
  reorderLevel?: number;
  status?: string;
  [key: string]: unknown;
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
    api.get<unknown, ApiResponse<StoreInventoryRecord[]>>("/store-inventory/all", { params }),

  instantTransfer: (payload: {
    movementType: "STORE_TO_STORE";
    sourceType: "STORE";
    sourceId: string;
    destinationId: string;
    items: Array<{ productVariantId: string; quantity: number }>;
    remarks?: string;
  }) => api.post("/movements/instant-transfer", payload),
};
