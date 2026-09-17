import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { productApi, type PosJoinedVariant } from "./product-api";
import { useLiveCatalog } from "./use-live-catalog";

const variant: PosJoinedVariant = {
  _id: "variant-1",
  variantName: "Milk",
  productName: "Milk",
  categoryName: "Dairy",
  categoryId: "cat-1",
  sku: "MILK-1",
  sellingMode: "FIXED",
  unitValue: "1",
  unitType: "l",
  mrp: 60,
  price: 55,
  barcode: "",
  barcodes: [],
  taxRate: 5,
  quantityAvailable: 2,
};

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLiveCatalog", () => {
  it("renders the initial catalog without waiting for a failed inventory refresh", async () => {
    vi.spyOn(productApi, "getJoinedCatalog").mockResolvedValue({
      categories: [],
      variants: [variant],
    });
    vi.spyOn(productApi, "getInventorySnapshot").mockRejectedValue(new Error("Refresh offline"));

    const { result } = renderHook(() => useLiveCatalog("test-catalog", "store-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data?.variants).toHaveLength(1));
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.snapshotError).toBeTruthy(), { timeout: 3_000 });
  });

  it("merges live quantities and visibility into the catalog", async () => {
    vi.spyOn(productApi, "getJoinedCatalog").mockResolvedValue({
      categories: [],
      variants: [variant],
    });
    vi.spyOn(productApi, "getInventorySnapshot").mockResolvedValue({
      success: true,
      data: [
        {
          productVariantId: "variant-1",
          quantityAvailable: 9,
          quantityReserved: 0,
          quantityInTransit: 0,
          quantityDamaged: 0,
          quantityExpired: 0,
          reorderThreshold: 3,
          visible: true,
          stockStatus: "HEALTHY",
          inventoryVersion: 4,
          inventoryUpdatedAt: "2026-09-10T12:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useLiveCatalog("test-catalog", "store-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data?.variants[0]?.quantityAvailable).toBe(9));
    expect(result.current.data?.variants[0]?.inventoryVersion).toBe(4);
  });

  it("returns an actionable error when no store scope exists", () => {
    const catalog = vi.spyOn(productApi, "getJoinedCatalog");
    const snapshot = vi.spyOn(productApi, "getInventorySnapshot");

    const { result } = renderHook(() => useLiveCatalog("test-catalog"), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toMatch(/no store is assigned/i);
    expect(catalog).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("retries both catalog and inventory queries", async () => {
    const catalog = vi.spyOn(productApi, "getJoinedCatalog").mockResolvedValue({
      categories: [],
      variants: [variant],
    });
    const snapshot = vi.spyOn(productApi, "getInventorySnapshot").mockResolvedValue({
      success: true,
      data: [],
    });
    const { result } = renderHook(() => useLiveCatalog("test-catalog", "store-1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeTruthy());

    await act(async () => {
      await result.current.refetch();
    });

    expect(catalog).toHaveBeenCalledTimes(2);
    expect(snapshot).toHaveBeenCalledTimes(2);
  });
});
