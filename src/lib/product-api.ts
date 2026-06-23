import { api } from "@/lib/api";

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
  barcodes: Array<{ code: string; type: string; isPrimary: boolean }>;
  images: Array<{ url: string }>;
  active: boolean;
  taxRate: number;
  quantityAvailable?: number;
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
  barcode: string;
  imageUrl?: string;
  taxRate: number;
  quantityAvailable?: number;
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

function buildJoinedMap(products: PosProduct[], variants: PosVariant[]): PosJoinedVariant[] {
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
        price: v.pricePerUnit ?? v.mrp ?? 0,
        barcode: v.barcodes.find((b) => b.isPrimary)?.code ?? v.barcodes[0]?.code ?? "",
        imageUrl: v.images[0]?.url ?? product?.defaultImageUrl,
        taxRate: v.taxRate ?? 0,
        quantityAvailable: v.quantityAvailable,
      };
    });
}

export const productApi = {
  listCategories: () => api.get<unknown, ApiResponse<PosCategory[]>>("/categories"),

  listProducts: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosProduct[]>>("/products", { params }),

  listVariants: (params?: Record<string, unknown>) =>
    api.get<unknown, ApiResponse<PosVariant[]>>("/product-variants", { params }),

  getVariantByBarcode: (code: string, storeId?: string) =>
    api.get<unknown, ApiResponse<PosVariant>>(`/product-variants/barcode/${code}`, {
      params: storeId ? { storeId } : undefined,
    }),

  async getJoinedCatalog(params?: {
    search?: string;
    categoryId?: string;
    storeId?: string;
  }): Promise<{ variants: PosJoinedVariant[]; categories: PosCategory[] }> {
    const prodParams: Record<string, unknown> = { limit: 200, status: "active" };
    const varParams: Record<string, unknown> = { limit: 500 };
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
