import { runtimeConfig } from "./runtime-config";
import { posMaintenanceAccess } from "./pos-maintenance";
import { createPosApi } from "./create-pos-api";

let tokenGetter: (() => Promise<string | null>) | null = null;
export const getApiAuthToken = () => (tokenGetter ? tokenGetter() : Promise.resolve(null));
export const setClerkTokenGetter = (fn: (() => Promise<string | null>) | null) => {
  tokenGetter = fn;
};

export const api = createPosApi({
  baseURL: runtimeConfig.apiUrl,
  access: posMaintenanceAccess,
  getToken: getApiAuthToken,
  getOrganizationId: () => undefined,
  onSessionExpired: () => undefined,
});
