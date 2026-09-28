import { api } from "@/lib/api";

export interface MarkdownLabelResolution {
  markdownCode: string;
  productVariantId: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  basePrice: number;
  effectivePrice: number;
  remainingQuantity: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const LEGACY_MARKDOWN_CODE_PATTERN = /^MD[A-F0-9]{20}$/i;
export const BATCH_MARKDOWN_CODE_PATTERN = /^BATCH-MKD-[A-F0-9]{12}$/i;

export const isMarkdownCode = (value: string) =>
  LEGACY_MARKDOWN_CODE_PATTERN.test(value.trim()) || BATCH_MARKDOWN_CODE_PATTERN.test(value.trim());

export type MarkdownRequestType = "NEAR_EXPIRY" | "DAMAGED_DUMP";
export type MarkdownRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type MarkdownDamageType =
  | "PACKAGING_DAMAGE"
  | "COSMETIC_DAMAGE"
  | "LEAKAGE"
  | "BREAKAGE"
  | "CONTAMINATION"
  | "OTHER";

export interface MarkdownRequestScan {
  productVariantId: string;
  sku: string;
  productName: string;
  baseEan: string;
  mrp: number;
  normalSellingPrice: number;
  systemStock: number;
  batches: Array<{
    batchId: string;
    batchNumber: string;
    expiryDate?: string;
    quantityAvailable: number;
  }>;
}

export interface MarkdownRequestRecord {
  _id: string;
  requestNumber: string;
  requestType: MarkdownRequestType;
  disposition: "MARKDOWN" | "DUMP";
  status: MarkdownRequestStatus;
  sku: string;
  productName: string;
  batchNumber: string;
  requestedQuantity: number;
  proposedMarkdownPrice: number;
  expiryDate?: string;
  damageType?: MarkdownDamageType;
  rejectionReason?: string;
  proofUrl: string;
  campaignId?: {
    _id: string;
    markdownCode: string;
    quantityLimit: number;
    soldQuantity: number;
    status: string;
  } | null;
  writeOffId?: { _id: string; writeOffNumber: string; status: string } | null;
  createdAt: string;
}

export interface MarkdownRequestInput {
  requestType: MarkdownRequestType;
  storeId: string;
  productVariantId: string;
  batchId: string;
  baseEan: string;
  requestedQuantity: number;
  proposedMarkdownPrice: number;
  expiryDate?: string;
  damageType?: MarkdownDamageType;
  proofAssetId: string;
}

export const markdownApi = {
  scanRequestProduct: (storeId: string, ean: string) =>
    api.get<unknown, ApiResponse<MarkdownRequestScan>>("/inventory/markdown-portal/request-scan", {
      params: { storeId, ean },
    }),
  requests: (storeId: string) =>
    api.get<unknown, ApiResponse<MarkdownRequestRecord[]>>("/inventory/markdown-portal/requests", {
      params: { storeId, limit: 50 },
    }),
  createRequest: (data: MarkdownRequestInput) =>
    api.post<unknown, ApiResponse<MarkdownRequestRecord>>(
      "/inventory/markdown-portal/requests",
      data,
    ),
  submitRequest: (id: string) =>
    api.post<unknown, ApiResponse<MarkdownRequestRecord>>(
      `/inventory/markdown-portal/requests/${id}/submit`,
    ),
  requestLabel: (id: string) =>
    api.get<unknown, Blob>(`/inventory/markdown-portal/requests/${id}/label`, {
      responseType: "blob",
    }),
  resolveBaseEan: (storeId: string, ean: string) =>
    api.get<unknown, ApiResponse<MarkdownLabelResolution | null>>(
      "/inventory/markdown-portal/resolve-base-ean",
      { params: { storeId, ean: ean.trim() } },
    ),
  resolveLabel: (storeId: string, markdownCode: string) =>
    api.post<unknown, ApiResponse<MarkdownLabelResolution>>(
      "/inventory/markdown-portal/resolve-label",
      { storeId, markdownCode: markdownCode.trim().toUpperCase() },
    ),
};

export function getMarkdownErrorMessage(error: unknown) {
  const value = error as { code?: string; message?: string };
  const messages: Record<string, string> = {
    MARKDOWN_INVALID: "This markdown label is invalid, inactive, or belongs to another store.",
    MARKDOWN_EXPIRED: "This markdown batch has expired and cannot be sold.",
    MARKDOWN_EXHAUSTED: "Markdown Qty Exhausted",
    MARKDOWN_INSUFFICIENT_STOCK: "The labelled batch no longer has enough stock.",
  };
  return messages[value?.code || ""] || value?.message || "Unable to validate markdown label.";
}
