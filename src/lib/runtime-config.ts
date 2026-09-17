export const DEVELOPMENT_API_URL = "http://localhost:5002/api/v1";

export type RuntimeConfigKey = "VITE_CLERK_PUBLISHABLE_KEY" | "VITE_API_URL";

export interface RuntimeConfigEnv {
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  VITE_API_URL?: string;
  PROD?: boolean;
  MODE?: string;
}

export interface RuntimeConfig {
  clerkPublishableKey: string;
  apiUrl: string;
  missing: RuntimeConfigKey[];
  errors: string[];
  isValid: boolean;
  isProduction: boolean;
}

export function resolveRuntimeConfig(env: RuntimeConfigEnv): RuntimeConfig {
  const isProduction = env.PROD === true || env.MODE === "production";
  const clerkPublishableKey = env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const configuredApiUrl = env.VITE_API_URL?.trim() ?? "";
  const apiUrl = configuredApiUrl || (isProduction ? "" : DEVELOPMENT_API_URL);
  const missing: RuntimeConfigKey[] = [];
  const errors: string[] = [];

  if (!clerkPublishableKey) missing.push("VITE_CLERK_PUBLISHABLE_KEY");
  if (!apiUrl) missing.push("VITE_API_URL");

  if (isProduction && apiUrl) {
    try {
      const parsedApiUrl = new URL(apiUrl);
      if (parsedApiUrl.protocol !== "https:" || !parsedApiUrl.pathname.endsWith("/api/v1")) {
        errors.push("VITE_API_URL must be an HTTPS URL ending in /api/v1");
      }
    } catch {
      errors.push("VITE_API_URL must be a valid URL");
    }
  }

  return {
    clerkPublishableKey,
    apiUrl,
    missing,
    errors,
    isValid: missing.length === 0 && errors.length === 0,
    isProduction,
  };
}

export const runtimeConfig = resolveRuntimeConfig(import.meta.env);
