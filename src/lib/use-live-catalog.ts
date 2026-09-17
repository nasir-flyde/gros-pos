import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  filterStoreVisibleVariants,
  productApi,
  type PosInventorySnapshot,
  type PosJoinedVariant,
} from "@/lib/product-api";
import { readCatalogCache } from "@/lib/catalog-cache";
import { useAuthStore } from "@/lib/auth-store";

const MISSING_STORE_ERROR = new Error(
  "No store is assigned to this POS session. Ask an administrator to assign store access.",
);

export function useLiveCatalog(_queryKey: string, storeId?: string) {
  const organizationId = useAuthStore((state) => state.user?.organizationId) || "current";
  const cacheScope = JSON.stringify([organizationId, storeId]);
  const [persistedCatalog, setPersistedCatalog] = useState<{
    scope: string;
    variants: PosJoinedVariant[];
    categories: import("@/lib/product-api").PosCategory[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    setPersistedCatalog(null);
    if (storeId) {
      void readCatalogCache(organizationId, storeId).then((cached) => {
        if (active && cached) setPersistedCatalog({ ...cached.data, scope: cacheScope });
      });
    }
    return () => {
      active = false;
    };
  }, [organizationId, storeId, cacheScope]);

  const catalogQuery = useQuery({
    queryKey: ["pos-catalog", organizationId, storeId],
    queryFn: () => productApi.getJoinedCatalog({ storeId, organizationId, includeHidden: true }),
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    gcTime: 12 * 60 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const snapshotQuery = useQuery({
    queryKey: ["live-inventory-snapshot", organizationId, storeId],
    queryFn: async () => (await productApi.getInventorySnapshot(storeId as string)).data ?? [],
    enabled: !!storeId,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  });

  const data = useMemo(() => {
    const catalog =
      catalogQuery.data ?? (persistedCatalog?.scope === cacheScope ? persistedCatalog : null);
    if (!catalog) return catalog;
    const snapshotRows: PosInventorySnapshot[] = Array.isArray(snapshotQuery.data)
      ? snapshotQuery.data
      : [];
    const snapshot = new Map(snapshotRows.map((row) => [row.productVariantId, row]));
    const variants = catalog.variants.map((variant): PosJoinedVariant => {
      const live = snapshot.get(variant._id);
      return live ? { ...variant, ...live, _id: variant._id } : variant;
    });
    const visibleVariants = filterStoreVisibleVariants(variants);
    return { ...catalog, variants: visibleVariants };
  }, [catalogQuery.data, persistedCatalog, snapshotQuery.data, cacheScope]);

  const refetch = async () => Promise.all([catalogQuery.refetch(), snapshotQuery.refetch()]);

  return {
    ...catalogQuery,
    data,
    error: storeId ? catalogQuery.error : MISSING_STORE_ERROR,
    isError: !storeId || catalogQuery.isError,
    isLoading: Boolean(storeId) && catalogQuery.isLoading && persistedCatalog?.scope !== cacheScope,
    refetch,
    retryInventory: snapshotQuery.refetch,
    snapshotError: snapshotQuery.error,
    isInventoryRefreshing: snapshotQuery.isFetching && Boolean(snapshotQuery.data),
  };
}
