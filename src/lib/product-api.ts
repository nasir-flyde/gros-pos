import { api } from "@/lib/api";
import { getApiAuthToken } from "@/lib/api";
import { runtimeConfig } from "@/lib/runtime-config";
import { readCatalogCache, writeCatalogCache } from "@/lib/catalog-cache";

export interface PosCategory {
  _id: string;
  categoryCode: string;
  name: string;
  slug: string;
}

export interface PosVariant {
  _id: string;
  productId: string;
  sku: string;
  variantName: string;
  sellingMode: "FIXED" | "WEIGHT";
  unitType: string;
  unitValue: string;
  mrp: number;
  pricePerUnit: number;
  sellingPrice?: number;
  finalPrice?: number;
  discountPercent?: number;
  barcodes: Array<{ code: string; type: string; isPrimary: boolean }>;
  images: PosImage[];
  frontsiteImages?: PosImage[];
  frontsitePrimaryImage?: string;
  posImages?: PosImage[];
  posPrimaryImage?: string;
  active: boolean;
  taxRate: number;
  quantityAvailable?: number;
  quantityReserved?: number;
  quantityInTransit?: number;
  quantityDamaged?: number;
  quantityExpired?: number;
  reorderThreshold?: number;
  visible?: boolean;
  stockStatus?: "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY";
  inventoryVersion?: number;
  inventoryUpdatedAt?: string | null;
}

export interface PosImage {
  url: string;
  source?: "product" | string;
}

export interface PosProduct {
  _id: string;
  productCode: string;
  productName: string;
  categoryId: { _id: string; name: string };
  brandId?: { _id: string; name: string };
  defaultImageUrl?: string;
  variantCount: number;
  minMrp: number;
  active: boolean;
}

export interface PosJoinedVariant {
  _id: string;
  variantName: string;
  productName: string;
  brandName?: string;
  categoryName: string;
  categoryId: string;
  sku: string;
  sellingMode: "FIXED" | "WEIGHT";
  unitValue: string;
  unitType: string;
  mrp: number;
  price: number;
  sellingPrice?: number;
  finalPrice?: number;
  discountPercent?: number;
  barcode: string;
  barcodes: string[];
  imageUrl?: string;
  taxRate: number;
  quantityAvailable?: number;
  quantityReserved?: number;
  quantityInTransit?: number;
  quantityDamaged?: number;
  quantityExpired?: number;
  reorderThreshold?: number;
  stockStatus?: "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY";
  visible?: boolean;
  inventoryVersion?: number;
  inventoryUpdatedAt?: string | null;
}

export interface PosInventorySnapshot {
  productVariantId: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityInTransit: number;
  quantityDamaged: number;
  quantityExpired: number;
  reorderThreshold: number;
  visible: boolean;
  stockStatus: PosStockStatus;
  inventoryVersion: number;
  inventoryUpdatedAt: string | null;
}

export type PosStockStatus = "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY";

export function getVariantStockStatus(
  variant: Pick<PosJoinedVariant, "quantityAvailable" | "reorderThreshold" | "stockStatus">,
): PosStockStatus {
  if (variant.stockStatus) return variant.stockStatus;
  const quantity = variant.quantityAvailable ?? 0;
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (variant.reorderThreshold != null && variant.reorderThreshold > 0) {
    if (quantity <= Math.max(1, Math.floor(variant.reorderThreshold / 2))) return "CRITICAL";
    if (quantity <= variant.reorderThreshold) return "LOW";
    return "HEALTHY";
  }
  if (quantity < 10) return "CRITICAL";
  if (quantity < 20) return "LOW";
  return "HEALTHY";
}

export function filterStoreVisibleVariants(variants: PosJoinedVariant[]) {
  return variants.filter((variant) => variant.visible !== false);
}

export function buildInventorySnapshot(variants: PosVariant[]): PosInventorySnapshot[] {
  return variants.map((variant) => ({
    productVariantId: variant._id,
    quantityAvailable: Number(variant.quantityAvailable ?? 0),
    quantityReserved: Number(variant.quantityReserved ?? 0),
    quantityInTransit: Number(variant.quantityInTransit ?? 0),
    quantityDamaged: Number(variant.quantityDamaged ?? 0),
    quantityExpired: Number(variant.quantityExpired ?? 0),
    reorderThreshold: Number(variant.reorderThreshold ?? 0),
    visible: variant.visible !== false,
    stockStatus: getVariantStockStatus(variant),
    inventoryVersion: Number(variant.inventoryVersion ?? 0),
    inventoryUpdatedAt: variant.inventoryUpdatedAt ?? null,
  }));
}

export interface CartStockIssue {
  productVariantId: string;
  name: string;
  requested: number;
  available: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (("status" in error && error.status === 404) ||
      ("statusCode" in error && error.statusCode === 404) ||
      ("code" in error && error.code === "NOT_FOUND")),
  );
}

export function getEffectiveVariantPrice(
  variant: Pick<PosVariant, "finalPrice" | "sellingPrice" | "pricePerUnit" | "mrp">,
): number {
  return variant.finalPrice ?? variant.sellingPrice ?? variant.pricePerUnit ?? variant.mrp ?? 0;
}

export function getPosImageUrl(
  variant: Pick<
    PosVariant,
    "posPrimaryImage" | "posImages" | "frontsitePrimaryImage" | "frontsiteImages" | "images"
  >,
  product?: Pick<PosProduct, "defaultImageUrl">,
) {
  return (
    variant.posPrimaryImage ||
    variant.posImages?.[0]?.url ||
    variant.frontsitePrimaryImage ||
    variant.frontsiteImages?.[0]?.url ||
    variant.images?.[0]?.url ||
    product?.defaultImageUrl?.split(",")[0]?.trim() ||
    undefined
  );
}

export function getPosThumbnailUrl(url?: string) {
  if (!url || !url.includes("imagekit.io")) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("tr"))
      parsed.searchParams.set("tr", "w-320,h-320,cm-pad_resize,q-75,f-auto");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildJoinedMap(products: PosProduct[], variants: PosVariant[]): PosJoinedVariant[] {
  const productMap = new Map(products.map((p) => [p._id, p]));
  return variants
    .filter((v) => v.active)
    .map((v) => {
      const product = productMap.get(v.productId);
      return {
        _id: v._id,
        variantName: v.variantName,
        productName: product?.productName ?? v.variantName,
        brandName: product?.brandId?.name,
        categoryName: product?.categoryId?.name ?? "Uncategorized",
        categoryId: product?.categoryId?._id ?? "",
        sku: v.sku,
        sellingMode: v.sellingMode,
        unitValue: v.unitValue,
        unitType: v.unitType,
        mrp: v.mrp ?? 0,
        price: getEffectiveVariantPrice(v),
        sellingPrice: v.sellingPrice,
        finalPrice: v.finalPrice,
        discountPercent: v.discountPercent,
        barcode: v.barcodes.find((b) => b.isPrimary)?.code ?? v.barcodes[0]?.code ?? "",
        barcodes: v.barcodes.map((b) => b.code),
        imageUrl: getPosImageUrl(v, product),
        taxRate: v.taxRate ?? 0,
        quantityAvailable: v.quantityAvailable,
        quantityReserved: v.quantityReserved,
        quantityInTransit: v.quantityInTransit,
        quantityDamaged: v.quantityDamaged,
        quantityExpired: v.quantityExpired,
        reorderThreshold: v.reorderThreshold,
        stockStatus: v.stockStatus,
        visible: v.visible,
        inventoryVersion: v.inventoryVersion,
        inventoryUpdatedAt: v.inventoryUpdatedAt,
      };
    });
}

export function findCartStockIssues(
  cartItems: Array<{ product: { _id: string; name: string }; qty: number }>,
  variants: Array<Pick<PosVariant, "_id" | "quantityAvailable">>,
): CartStockIssue[] {
  const stockByVariantId = new Map(
    variants.map((variant) => [variant._id, Number(variant.quantityAvailable || 0)]),
  );
  return cartItems.flatMap((item) => {
    const available = stockByVariantId.get(item.product._id) ?? 0;
    return item.qty > available
      ? [
          {
            productVariantId: item.product._id,
            name: item.product.name,
            requested: item.qty,
            available,
          },
        ]
      : [];
  });
}

export const productApi = {
  listCategories: () => api.get<unknown, ApiResponse<PosCategory[]>>("/categories"),

  listProducts: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosProduct[]>>("/products", { params }),

  listVariants: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosVariant[]>>("/product-variants", { params }),

  async getInventorySnapshot(storeId: string): Promise<ApiResponse<PosInventorySnapshot[]>> {
    try {
      return await api.get<unknown, ApiResponse<PosInventorySnapshot[]>>(
        "/pos/inventory-snapshot",
        { params: { storeId } },
      );
    } catch (error) {
      if (!isNotFoundError(error)) throw error;

      // Rolling-deployment compatibility: older backends expose the same scoped fields
      // through product variants. Only a missing route activates this heavier fallback.
      const response = await this.listVariants({ storeId, status: "active", limit: 10000 });
      return { ...response, data: buildInventorySnapshot(response.data ?? []) };
    }
  },

  getVariantByBarcode: (code: string, storeId?: string) =>
    api.get<unknown, ApiResponse<PosVariant>>(`/product-variants/barcode/${code}`, {
      params: storeId ? { storeId } : undefined,
    }),

  async getStoreVariantStock(variantIds: string[], storeId: string): Promise<PosVariant[]> {
    if (variantIds.length === 0) return [];
    const response = await api.get<unknown, ApiResponse<PosVariant[]>>("/pos/variants", {
      params: { storeId, ids: variantIds.join(",") },
    });
    return response.data ?? [];
  },

  async getJoinedCatalog(params?: {
    search?: string;
    categoryId?: string;
    storeId?: string;
    includeHidden?: boolean;
    organizationId?: string;
  }): Promise<{ variants: PosJoinedVariant[]; categories: PosCategory[] }> {
    const fastCatalogEnabled = import.meta.env.VITE_POS_FAST_CATALOG !== "false";
    if (fastCatalogEnabled && params?.storeId) {
      const organizationId = params.organizationId || "current";
      const cached = await readCatalogCache(organizationId, params.storeId);
      try {
        const token = await getApiAuthToken();
        const url = new URL(`${runtimeConfig.apiUrl}/pos/catalog`);
        url.searchParams.set("storeId", params.storeId);
        const response = await fetch(url, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
          },
        });
        if (response.status === 304 && cached) return cached.data;
        if (!response.ok) {
          throw {
            status: response.status,
            message: `POS catalog request failed (${response.status})`,
          };
        }
        const payload = (await response.json()) as ApiResponse<{
          version?: string;
          generatedAt?: string;
          variants: PosJoinedVariant[];
          categories: PosCategory[];
        }>;
        const data = payload.data;
        if (!data || !Array.isArray(data.variants) || !Array.isArray(data.categories)) {
          throw new Error("POS catalog returned an invalid response");
        }
        await writeCatalogCache({
          organizationId,
          storeId: params.storeId,
          etag: response.headers.get("etag") || undefined,
          data,
        });
        return data;
      } catch (error) {
        const status =
          typeof error === "object" && error && "status" in error
            ? Number(error.status)
            : undefined;
        if (status === 401 || status === 403) throw error;
        if (cached && (!status || status >= 500)) return cached.data;
        // Rolling deployment fallback while the new backend endpoint is canaried.
        if (status !== 404 || import.meta.env.VITE_POS_FAST_CATALOG_FALLBACK === "false") {
          throw error;
        }
      }
    }

    const prodParams: Record<string, unknown> = { limit: 10000, status: "active" };
    const varParams: Record<string, unknown> = { limit: 10000 };
    if (params?.search) {
      prodParams.search = params.search;
    }
    if (params?.storeId) {
      varParams.storeId = params.storeId;
    }

    const [catRes, prodRes, varRes] = await Promise.all([
      this.listCategories(),
      this.listProducts(prodParams),
      this.listVariants(varParams),
    ]);

    const categories = catRes.data ?? [];
    const products = prodRes.data ?? [];
    const variants = varRes.data ?? [];
    let joined = buildJoinedMap(products, variants);
    if (!params?.includeHidden) {
      joined = filterStoreVisibleVariants(joined);
    }

    if (params?.categoryId) {
      joined = joined.filter((v) => v.categoryId === params.categoryId);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      joined = joined.filter(
        (v) =>
          v.variantName.toLowerCase().includes(q) ||
          v.productName.toLowerCase().includes(q) ||
          v.barcode.includes(q) ||
          v.brandName?.toLowerCase().includes(q),
      );
    }

    return { variants: joined, categories };
  },
};
