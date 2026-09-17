import { api } from "@/lib/api";

export type MovementStatus =
  | "DRAFT"
  | "REQUESTED"
  | "APPROVED"
  | "DISPATCHED"
  | "RECEIVED"
  | "CANCELLED"
  | "CLOSED";

export interface StockMovement {
  _id: string;
  movementNumber: string;
  movementType: string;
  sourceType: string;
  sourceId: string;
  status: MovementStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
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

export const movementApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<StockMovement[]>>("/movements", { params }),

  create: (payload: {
    movementType: string;
    sourceType: string;
    sourceId: string;
    destinationIds: string[];
    remarks?: string;
  }) => api.post<unknown, ApiResponse<StockMovement>>("/movements", payload),

  addItem: (
    movementId: string,
    payload: {
      productVariantId: string;
      dispatch?: Record<string, number>;
      remarks?: string;
    },
  ) =>
    api.post<unknown, ApiResponse<Record<string, unknown>>>(
      `/movements/${movementId}/items`,
      payload,
    ),

  submit: (movementId: string) =>
    api.post<unknown, ApiResponse<StockMovement>>(`/movements/${movementId}/submit`, {}),
};
