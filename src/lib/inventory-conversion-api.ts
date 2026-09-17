import { api } from "@/lib/api";

export type ConversionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "POSTED"
  | "REJECTED"
  | "CANCELLED"
  | "REVERSED";

export interface ConversionStore {
  _id: string;
  storeName?: string;
  storeCode?: string;
}

export interface ConversionVariant {
  _id: string;
  sku?: string;
  variantName?: string;
  sellingMode?: "FIXED" | "WEIGHT";
  unitType?: string;
  unitValue?: string | number;
}

export interface ConversionBatch {
  _id: string;
  batchNumber: string;
  productVariantId?: string | ConversionVariant;
  manufactureDate?: string;
  expiryDate?: string;
  quantityAvailable: number;
  quantityReserved?: number;
  purchaseRate?: number;
}

export interface ConversionRule {
  _id: string;
  storeId: string | ConversionStore;
  sourceVariantId: string | ConversionVariant;
  targetVariantId: string | ConversionVariant;
  sourceQuantity: number;
  expectedOutputQuantity: number;
  active: boolean;
}

export interface ConversionPreview {
  sourceQuantity: number;
  expectedOutputQuantity: number;
  actualOutputQuantity: number;
  lossQuantity: number;
  sourceUnitCost: number;
  sourceInventoryValue: number;
  targetUnitCost: number;
  targetInventoryValue: number;
  lossInventoryValue: number;
  targetSellingMode: "FIXED" | "WEIGHT";
  targetUnitType: string;
}

export interface InventoryConversion extends ConversionPreview {
  _id: string;
  conversionNumber: string;
  storeId: string | ConversionStore;
  ruleId: string;
  sourceVariantId: string | ConversionVariant;
  targetVariantId: string | ConversionVariant;
  sourceBatchId: string | ConversionBatch;
  targetBatchId?: string | ConversionBatch;
  status: ConversionStatus;
  lossReason?: string;
  remarks?: string;
  submittedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  reversalReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: { page: number; limit: number; totalDocs: number; totalPages: number };
}

export interface ConversionInput {
  storeId: string;
  ruleId: string;
  sourceBatchId: string;
  sourceQuantity: number;
  actualOutputQuantity: number;
  lossReason?: string;
  remarks?: string;
}

export const inventoryConversionApi = {
  listRules: (storeId: string) =>
    api.get<unknown, Envelope<ConversionRule[]>>("/inventory/conversions/rules", {
      params: { storeId, active: true, limit: 1000 },
    }),
  listBatches: (storeId: string, productVariantId: string) =>
    api.get<unknown, Envelope<ConversionBatch[]>>("/store-inventory/batches", {
      params: { storeId, productVariantId, limit: 1000 },
    }),
  preview: (payload: ConversionInput) =>
    api.post<unknown, Envelope<ConversionPreview>>("/inventory/conversions/preview", payload),
  createDraft: (payload: ConversionInput & { idempotencyKey: string }) =>
    api.post<unknown, Envelope<InventoryConversion>>("/inventory/conversions", payload),
  updateDraft: (
    id: string,
    payload: Partial<Omit<ConversionInput, "storeId" | "ruleId" | "lossReason" | "remarks">> & {
      lossReason?: string | null;
      remarks?: string | null;
    },
  ) => api.put<unknown, Envelope<InventoryConversion>>(`/inventory/conversions/${id}`, payload),
  submit: (id: string) =>
    api.post<unknown, Envelope<InventoryConversion>>(`/inventory/conversions/${id}/submit`),
  cancel: (id: string, reason: string) =>
    api.post<unknown, Envelope<InventoryConversion>>(`/inventory/conversions/${id}/cancel`, {
      reason,
    }),
  list: (storeId: string) =>
    api.get<unknown, Envelope<InventoryConversion[]>>("/inventory/conversions", {
      params: { storeId, limit: 100 },
    }),
  get: (id: string) =>
    api.get<unknown, Envelope<InventoryConversion>>(`/inventory/conversions/${id}`),
};

export function variantId(value: string | ConversionVariant | undefined) {
  return typeof value === "string" ? value : (value?._id ?? "");
}

export function variantLabel(value: string | ConversionVariant | undefined) {
  if (!value) return "Unknown item";
  if (typeof value === "string") return value;
  return [value.sku, value.variantName].filter(Boolean).join(" · ") || value._id;
}

export function batchId(value: string | ConversionBatch | undefined) {
  return typeof value === "string" ? value : (value?._id ?? "");
}
