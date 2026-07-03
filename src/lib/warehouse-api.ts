import { api } from "@/lib/api";

export interface PosWarehouse {
  _id: string;
  warehouseName: string;
  warehouseCode: string;
  status?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const warehouseApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosWarehouse[]>>("/warehouses", { params }),
};
