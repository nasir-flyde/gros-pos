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

export const MARKDOWN_CODE_PATTERN = /^MD[A-F0-9]{20}$/i;

export const isMarkdownCode = (value: string) => MARKDOWN_CODE_PATTERN.test(value.trim());

export const markdownApi = {
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
    MARKDOWN_EXHAUSTED: "All units assigned to this markdown campaign have been sold.",
    MARKDOWN_INSUFFICIENT_STOCK: "The labelled batch no longer has enough stock.",
  };
  return messages[value?.code || ""] || value?.message || "Unable to validate markdown label.";
}
