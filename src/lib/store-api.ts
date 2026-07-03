import { api } from "@/lib/api";

export interface PosStore {
  _id: string;
  storeName: string;
  storeCode: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const storesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosStore[]>>("/stores", { params }),
};
