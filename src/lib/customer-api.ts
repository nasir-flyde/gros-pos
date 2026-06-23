import { api } from "@/lib/api";

export interface PosCustomer {
  _id: string;
  name: string;
  mobile: string;
  email?: string;
  area?: string;
  pincode?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  ordersCount: number;
  totalSpend: number;
  status: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export const customerApi = {
  search: (search?: string, params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosCustomer[]>>("/customers", {
      params: { ...params, ...(search ? { search } : {}) },
    }),

  getById: (id: string) =>
    api.get<unknown, ApiResponse<PosCustomer>>(`/customers/${id}`),

  create: (data: { name: string; mobile: string; area?: string; pincode?: string; address?: string }) =>
    api.post<unknown, ApiResponse<PosCustomer>>("/customers", data),
};
