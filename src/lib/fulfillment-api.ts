import { api } from "@/lib/api";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface FulfillmentTask {
  _id: string;
  orderId: string | { _id: string };
  storeId: string;
  status: string;
}

export interface FulfillmentItem {
  _id: string;
  quantityRequested: number;
  quantityPicked?: number;
}

export interface FulfillmentTaskDetail extends FulfillmentTask {
  items: FulfillmentItem[];
}

const orderIdValue = (task: FulfillmentTask) =>
  typeof task.orderId === "string" ? task.orderId : task.orderId._id;

export const fulfillmentApi = {
  listTasks: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<FulfillmentTask[]>>("/fulfillment-tasks", { params }),

  getTask: (taskId: string) =>
    api.get<unknown, ApiResponse<FulfillmentTaskDetail>>(`/fulfillment-tasks/${taskId}`),

  startPicking: (taskId: string) =>
    api.post<unknown, ApiResponse<FulfillmentTask>>(`/fulfillment-tasks/${taskId}/start`, {}),

  recordPick: (
    taskId: string,
    payload: { fulfillmentItemId: string; quantityPicked: number; shortPickReason?: string },
  ) =>
    api.post<unknown, ApiResponse<FulfillmentItem>>(
      `/fulfillment-tasks/${taskId}/pick-item`,
      payload,
    ),

  completePicking: (taskId: string) =>
    api.post<unknown, ApiResponse<FulfillmentTask>>(`/fulfillment-tasks/${taskId}/complete`, {}),

  orderIdValue,
};
