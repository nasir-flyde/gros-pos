import { api } from "@/lib/api";

export interface DailySalesRow {
  date: string;
  invoiceNo: string;
  storeCode: string;
  articleId: string;
  sku: string;
  primaryBarcode: string;
  itemCategoryCode: string;
  variantName: string;
  itemDescription: string;
  hsnCode: string;
  taxPercent: number;
  quantity: number;
  mrp: number;
  lineDiscount: number;
  netAmount: number;
  salesTaxableValue: number | null;
  gstCollected: number | null;
  modeOfReceipt: string;
}

interface DailySalesReport {
  rows: DailySalesRow[];
  summary?: Record<string, number>;
  header?: { storeName?: string; location?: string; reportName?: string };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const reportApi = {
  dailySales: (params: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<DailySalesReport>>("/reports/daily-sales-report", { params }),

  async downloadDailySales(params: Record<string, unknown>, filename: string) {
    const csv = await api.get<unknown, Blob>("/reports/daily-sales-report/export", {
      params,
      responseType: "blob",
    });
    const url = URL.createObjectURL(csv);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
