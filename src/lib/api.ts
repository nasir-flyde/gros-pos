import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let _getClerkToken: (() => Promise<string | null>) | null = null;

export const setClerkTokenGetter = (fn: () => Promise<string | null>) => {
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
      return Promise.reject(serverError);
    }
    return Promise.reject({
      success: false,
      message: error.message || "Network error occurred",
      code: "NETWORK_ERROR",
    });
  },
);
