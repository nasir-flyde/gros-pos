import axios from "axios";
import { runtimeConfig } from "./runtime-config";

export const api = axios.create({
  baseURL: runtimeConfig.apiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

let _getClerkToken: (() => Promise<string | null>) | null = null;

export const getApiAuthToken = () => (_getClerkToken ? _getClerkToken() : Promise.resolve(null));

export const setClerkTokenGetter = (fn: (() => Promise<string | null>) | null) => {
  _getClerkToken = fn;
};

api.interceptors.request.use(
  async (config) => {
    if (_getClerkToken) {
      try {
        const token = await _getClerkToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Clerk token not available — request will proceed without auth header
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const serverError = error.response?.data;
    if (serverError && typeof serverError === "object") {
      return Promise.reject({ ...serverError, status: error.response?.status });
    }
    return Promise.reject({
      success: false,
      message: error.message || "Network error occurred",
      code: "NETWORK_ERROR",
      status: error.response?.status,
    });
  },
);
