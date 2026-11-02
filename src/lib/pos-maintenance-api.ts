import { api } from "./api";
import { posMaintenanceAccess } from "./pos-maintenance";

export const checkPosMaintenance = () =>
  posMaintenanceAccess.checkStatus(async (signal) => {
    const response = await api.get<unknown, { data: unknown }>("/pos/maintenance", {
      signal,
      timeout: 10_000,
    });
    return response.data;
  });
