import { api } from "@/lib/api";

export interface PosCustomer {
  _id: string;
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  area?: string;
  pincode?: string;
  primaryAddress?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  addresses?: Array<{
    line?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    isDefault?: boolean;
  }>;
  orders?: number;
  ordersCount?: number;
  totalSpend?: number;
  status: string;
  createdAt: string;
}

export const getCustomerMobile = (customer: PosCustomer) => customer.phone || customer.mobile || "";

export const getCustomerOrderCount = (customer: PosCustomer) =>
  customer.orders ?? customer.ordersCount ?? 0;

export const getCustomerAddress = (customer: PosCustomer) => {
  const defaultAddress = customer.addresses?.find((address) => address.isDefault);
  const address = defaultAddress ?? customer.addresses?.[0] ?? customer.address;
  const line = defaultAddress?.line || address?.line1;
  const locality = [
    address?.line2,
    address?.city || customer.area,
    address?.state,
    address?.pincode || customer.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    [line || customer.primaryAddress, locality].filter(Boolean).join(", ") ||
    [customer.area, customer.pincode].filter(Boolean).join(" · ")
  );
};

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

  getById: (id: string) => api.get<unknown, ApiResponse<PosCustomer>>(`/customers/${id}`),

  create: (data: {
    name: string;
    mobile: string;
    area?: string;
    pincode?: string;
    address?: string;
  }) => api.post<unknown, ApiResponse<PosCustomer>>("/customers", data),
};
