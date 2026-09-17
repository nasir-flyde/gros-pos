import { describe, expect, it } from "vitest";
import { DEVELOPMENT_API_URL, resolveRuntimeConfig } from "./runtime-config";

describe("resolveRuntimeConfig", () => {
  it("accepts complete production configuration", () => {
    const config = resolveRuntimeConfig({
      PROD: true,
      VITE_CLERK_PUBLISHABLE_KEY: "pk_live_example",
      VITE_API_URL: "https://api.example.com/api/v1",
    });

    expect(config).toMatchObject({
      isValid: true,
      isProduction: true,
      clerkPublishableKey: "pk_live_example",
      apiUrl: "https://api.example.com/api/v1",
      missing: [],
      errors: [],
    });
  });

  it("allows repository-provided Clerk keys in production", () => {
    const config = resolveRuntimeConfig({
      PROD: true,
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      VITE_API_URL: "https://api.example.com/api/v1",
    });

    expect(config.isValid).toBe(true);
    expect(config.errors).toEqual([]);
  });

  it("rejects an insecure or incorrectly based production API URL", () => {
    const config = resolveRuntimeConfig({
      MODE: "production",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_live_example",
      VITE_API_URL: "http://api.example.com",
    });

    expect(config.isValid).toBe(false);
    expect(config.errors).toContain("VITE_API_URL must be an HTTPS URL ending in /api/v1");
  });

  it("requires Clerk in every environment", () => {
    const config = resolveRuntimeConfig({ MODE: "development" });

    expect(config.isValid).toBe(false);
    expect(config.missing).toEqual(["VITE_CLERK_PUBLISHABLE_KEY"]);
  });

  it("requires an API URL in production", () => {
    const config = resolveRuntimeConfig({
      MODE: "production",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_live_example",
    });

    expect(config.isValid).toBe(false);
    expect(config.apiUrl).toBe("");
    expect(config.missing).toEqual(["VITE_API_URL"]);
  });

  it("uses the localhost API only in development", () => {
    const config = resolveRuntimeConfig({
      MODE: "development",
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_example",
    });

    expect(config.isValid).toBe(true);
    expect(config.apiUrl).toBe(DEVELOPMENT_API_URL);
  });
});
