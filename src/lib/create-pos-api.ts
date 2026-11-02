import axios from "axios";
import {
  posApiPath,
  isMaintenanceControlRequest,
  type PosMaintenanceAccess,
} from "./pos-maintenance.ts";

import {
  beginPosTransaction,
  completePosTransaction,
  interruptPosTransaction,
  resolvePosPayment,
} from "./pos-transaction-guard";

declare module "axios" {
  export interface AxiosRequestConfig {
    suppressSessionExpiredEvent?: boolean;
    posTransactionId?: string;
    posRequestRelease?: () => void;
  }
}

export function createPosApi({
  baseURL,
  access,
  getToken,
  getOrganizationId,
  onSessionExpired,
}: {
  baseURL: string;
  access: PosMaintenanceAccess;
  getToken: () => Promise<string | null>;
  getOrganizationId: () => string | null | undefined;
  onSessionExpired: () => void;
}) {
  const client = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });
  client.interceptors.request.use(async (config) => {
    config.url = posApiPath(config.url ?? "");
    const controlRequest = isMaintenanceControlRequest(config.url, config.method);
    if (!controlRequest) {
      const request = access.acquireRequest(config.signal as AbortSignal | undefined);
      config.signal = request.signal;
      config.posRequestRelease = request.release;
    }
    try {
      const organizationId = getOrganizationId();
      if (organizationId && !config.headers.get("X-Organization-Id"))
        config.headers["X-Organization-Id"] = organizationId;
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      // Pause/sign-out may have happened while Clerk was getting the token.
      if (!controlRequest) access.assertPosAccess();
      if (
        config.method === "post" &&
        ["/pos/checkout", "/pos/paytm/request"].includes(config.url)
      ) {
        config.posTransactionId = beginPosTransaction(config.url);
        config.headers["Idempotency-Key"] = config.posTransactionId;
      }
      return config;
    } catch (error) {
      config.posRequestRelease?.();
      throw error;
    }
  });
  client.interceptors.response.use(
    (response) => {
      response.config.posRequestRelease?.();
      if (response.config.posTransactionId)
        completePosTransaction(
          response.config.posTransactionId,
          response.data?.data?.paymentTransactionId,
        );
      if (
        response.config.url?.startsWith("/pos/paytm/payments/") &&
        ["COMPLETED", "FAILED"].includes(response.data?.data?.status)
      ) {
        resolvePosPayment(response.config.url.split("/")[4]);
      }
      return response.data;
    },
    (error: unknown) => {
      if (!axios.isAxiosError(error)) return Promise.reject(error);
      error.config?.posRequestRelease?.();
      if (axios.isCancel(error)) {
        if (error.config?.posTransactionId)
          interruptPosTransaction(error.config.posTransactionId, { code: "REQUEST_CANCELLED" });
        return Promise.reject({
          success: false,
          code: "REQUEST_CANCELLED",
          message: "Request cancelled",
        });
      }
      const serverError = error.response?.data;
      const normalized =
        serverError && typeof serverError === "object"
          ? {
              ...serverError,
              status: error.response?.status,
              requestId: serverError.requestId ?? error.response?.headers?.["x-request-id"],
            }
          : {
              message: error.message || "Network error occurred",
              code: "NETWORK_ERROR",
              status: error.response?.status,
            };
      if (error.config?.posTransactionId)
        interruptPosTransaction(error.config.posTransactionId, normalized);
      if (normalized.code === "POS_PAUSED") access.receivePausedResponse();
      if (normalized.status === 401 && !error.config?.suppressSessionExpiredEvent)
        onSessionExpired();
      return Promise.reject({
        ...normalized,
        response: { data: normalized, status: normalized.status },
      });
    },
  );
  return client;
}
