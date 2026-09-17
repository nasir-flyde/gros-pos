import { api } from "@/lib/api";

export type ShelfLabelReason = "PRICE_CHANGE" | "NEW_STOCK" | "PROMOTION";
export type ShelfLabelLayout = "THERMAL_50X30" | "A4_50X30";

export interface ShelfLabelStore {
  _id: string;
  storeName: string;
  storeCode: string;
}

export interface ShelfLabelPromotion {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
  startsAt: string;
  endsAt: string;
  sourceStoreId?: string | null;
}

export interface ShelfLabelCandidate {
  productVariantId: string;
  productName?: string;
  productCode?: string;
  sku?: string;
  variantName?: string;
  unitType?: string;
  unitValue?: number;
  primaryBarcode?: string | null;
  mrp?: number | null;
  regularPrice?: number;
  effectivePrice?: number;
  savings?: number;
  promotion?: ShelfLabelPromotion | null;
  reasons: ShelfLabelReason[];
  printable: boolean;
  errors: string[];
}

export interface ShelfLabelSnapshot extends ShelfLabelCandidate {
  quantity: number;
}

export interface ShelfLabelPrintBatch {
  _id: string;
  batchNumber: string;
  storeId: string;
  storeSnapshot: { storeName: string; storeCode: string };
  layout: ShelfLabelLayout;
  items?: ShelfLabelSnapshot[];
  totalLabels: number;
  generatedAt: string;
  createdAt: string;
}

export interface ShelfLabelPageMeta {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

export interface ShelfLabelEnvelope<T> {
  data: T;
  meta?: ShelfLabelPageMeta;
  message?: string;
}

export const shelfLabelApi = {
  stores: () => api.get<unknown, ShelfLabelEnvelope<ShelfLabelStore[]>>("/shelf-labels/stores"),

  candidates: (params: Record<string, unknown>) =>
    api.get<unknown, ShelfLabelEnvelope<ShelfLabelCandidate[]>>("/shelf-labels/candidates", {
      params,
    }),

  createBatch: (payload: {
    storeId: string;
    layout: ShelfLabelLayout;
    items: Array<{ productVariantId: string; quantity: number }>;
  }) =>
    api.post<unknown, ShelfLabelEnvelope<ShelfLabelPrintBatch>>(
      "/shelf-labels/print-batches",
      payload,
    ),

  history: (params?: Record<string, unknown>) =>
    api.get<unknown, ShelfLabelEnvelope<ShelfLabelPrintBatch[]>>("/shelf-labels/print-batches", {
      params,
    }),

  pdf: (id: string) =>
    api.get<unknown, Blob>(`/shelf-labels/print-batches/${id}/pdf`, {
      responseType: "blob",
    }),
};

export function buildShelfLabelItems(selection: Record<string, number>) {
  return Object.entries(selection)
    .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
    .map(([productVariantId, quantity]) => ({ productVariantId, quantity }));
}

export function countShelfLabels(selection: Record<string, number>) {
  return buildShelfLabelItems(selection).reduce((sum, item) => sum + item.quantity, 0);
}

export function downloadShelfLabelPdf(blobUrl: string, batchNumber: string) {
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${batchNumber}.pdf`;
  anchor.click();
}

export function printShelfLabelPdf(blobUrl: string) {
  const popup = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!popup) return false;
  popup.addEventListener("load", () => popup.print(), { once: true });
  return true;
}
