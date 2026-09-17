import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

import {
  buildInventorySnapshot,
  buildJoinedMap,
  filterStoreVisibleVariants,
  findCartStockIssues,
  getEffectiveVariantPrice,
  getPosImageUrl,
  getVariantStockStatus,
  productApi,
} from "./product-api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("productApi.getJoinedCatalog fast endpoint", () => {
  it("uses the compact response and revalidates it with an ETag", async () => {
    const data = { categories: [], variants: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json", etag: '"catalog-v1"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      productApi.getJoinedCatalog({ storeId: "fast-store", organizationId: "fast-org" }),
    ).resolves.toEqual(data);
    await expect(
      productApi.getJoinedCatalog({ storeId: "fast-store", organizationId: "fast-org" }),
    ).resolves.toEqual(data);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["If-None-Match"]).toBe('"catalog-v1"');
  });
});

describe("buildInventorySnapshot", () => {
  it("normalizes store-scoped variant inventory for live catalog updates", () => {
    const [snapshot] = buildInventorySnapshot([
      {
        _id: "variant-1",
        productId: "product-1",
        sku: "MILK-1L-001",
        variantName: "Milk 1L",
        sellingMode: "FIXED",
        unitType: "ml",
        unitValue: "1000",
        mrp: 60,
        pricePerUnit: 55,
        barcodes: [],
        images: [],
        active: true,
        taxRate: 5,
        quantityAvailable: 8,
        quantityReserved: 2,
        reorderThreshold: 10,
        visible: false,
        inventoryVersion: 3,
        inventoryUpdatedAt: "2026-09-10T12:00:00.000Z",
      },
    ]);

    expect(snapshot).toEqual({
      productVariantId: "variant-1",
      quantityAvailable: 8,
      quantityReserved: 2,
      quantityInTransit: 0,
      quantityDamaged: 0,
      quantityExpired: 0,
      reorderThreshold: 10,
      visible: false,
      stockStatus: "LOW",
      inventoryVersion: 3,
      inventoryUpdatedAt: "2026-09-10T12:00:00.000Z",
    });
  });
});

describe("productApi.getInventorySnapshot", () => {
  it("uses the compact POS snapshot endpoint", async () => {
    const response = { success: true, data: [] };
    const get = vi.spyOn(api, "get").mockResolvedValue(response);

    await expect(productApi.getInventorySnapshot("store-1")).resolves.toBe(response);
    expect(get).toHaveBeenCalledWith("/pos/inventory-snapshot", {
      params: { storeId: "store-1" },
    });
  });

  it("falls back to scoped product variants only when the route is missing", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockRejectedValueOnce({ status: 404, code: "NOT_FOUND" })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            _id: "variant-1",
            productId: "product-1",
            sku: "MILK-1",
            variantName: "Milk",
            sellingMode: "FIXED",
            unitType: "ml",
            unitValue: "1000",
            mrp: 60,
            pricePerUnit: 55,
            barcodes: [],
            images: [],
            active: true,
            taxRate: 5,
            quantityAvailable: 7,
          },
        ],
      });

    const response = await productApi.getInventorySnapshot("store-1");

    expect(get).toHaveBeenNthCalledWith(2, "/product-variants", {
      params: { storeId: "store-1", status: "active", limit: 10000 },
    });
    expect(response.data[0]).toEqual(
      expect.objectContaining({ productVariantId: "variant-1", quantityAvailable: 7 }),
    );
  });

  it("does not hide authorization or server failures behind the fallback", async () => {
    const error = { status: 403, code: "FORBIDDEN", message: "Access denied" };
    const get = vi.spyOn(api, "get").mockRejectedValue(error);

    await expect(productApi.getInventorySnapshot("store-1")).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("getEffectiveVariantPrice", () => {
  it("prefers finalPrice over sellingPrice and base variant fields", () => {
    expect(
      getEffectiveVariantPrice({
        mrp: 60,
        pricePerUnit: 58,
        sellingPrice: 55,
        finalPrice: 49.5,
      }),
    ).toBe(49.5);
  });

  it("falls back to sellingPrice when finalPrice is absent", () => {
    expect(
      getEffectiveVariantPrice({
        mrp: 60,
        pricePerUnit: 58,
        sellingPrice: 55,
      }),
    ).toBe(55);
  });

  it("falls back to base price fields when no scoped pricing exists", () => {
    expect(
      getEffectiveVariantPrice({
        mrp: 0,
        pricePerUnit: 42,
      }),
    ).toBe(42);
  });
});

describe("buildJoinedMap", () => {
  it("maps joined catalog price from finalPrice and preserves pricing metadata", () => {
    const products = [
      {
        _id: "product-1",
        productCode: "MILK-1L",
        productName: "Milk 1L",
        categoryId: { _id: "cat-1", name: "Dairy" },
        brandId: { _id: "brand-1", name: "Amul" },
        defaultImageUrl: "https://example.com/product.png",
        variantCount: 1,
        minMrp: 60,
        active: true,
      },
    ];

    const variants = [
      {
        _id: "variant-1",
        productId: "product-1",
        sku: "MILK-1L-001",
        variantName: "Full Cream Milk 1L",
        sellingMode: "FIXED" as const,
        unitType: "ml",
        unitValue: "1000",
        mrp: 60,
        pricePerUnit: 0,
        sellingPrice: 55,
        finalPrice: 49.5,
        discountPercent: 10,
        barcodes: [{ code: "8901234567890", type: "EAN13", isPrimary: true }],
        images: [],
        active: true,
        taxRate: 5,
        quantityAvailable: 8,
      },
    ];

    const [joined] = buildJoinedMap(products, variants);

    expect(joined.price).toBe(49.5);
    expect(joined.sellingPrice).toBe(55);
    expect(joined.finalPrice).toBe(49.5);
    expect(joined.discountPercent).toBe(10);
    expect(joined.imageUrl).toBe("https://example.com/product.png");
  });

  it("excludes variants hidden for the selected store", () => {
    const products = [
      {
        _id: "product-1",
        productCode: "MILK",
        productName: "Milk",
        categoryId: { _id: "cat-1", name: "Dairy" },
        variantCount: 2,
        minMrp: 60,
        active: true,
      },
    ];
    const baseVariant = {
      productId: "product-1",
      sku: "MILK-1",
      variantName: "Milk 1L",
      sellingMode: "FIXED" as const,
      unitType: "ml",
      unitValue: "1000",
      mrp: 60,
      pricePerUnit: 0,
      barcodes: [],
      images: [],
      active: true,
      taxRate: 5,
    };

    const joined = buildJoinedMap(products, [
      { ...baseVariant, _id: "visible", visible: true },
      { ...baseVariant, _id: "hidden", visible: false },
    ]);

    expect(filterStoreVisibleVariants(joined).map((variant) => variant._id)).toEqual(["visible"]);
  });
});

describe("getPosImageUrl", () => {
  const baseVariant = {
    images: [{ url: "https://example.com/legacy.png" }],
  };

  it("prefers the POS primary image", () => {
    expect(
      getPosImageUrl({
        ...baseVariant,
        posPrimaryImage: "https://example.com/pos-primary.png",
        posImages: [{ url: "https://example.com/pos.png" }],
      }),
    ).toBe("https://example.com/pos-primary.png");
  });

  it("falls back through Frontsite and legacy images", () => {
    expect(
      getPosImageUrl({
        ...baseVariant,
        frontsiteImages: [{ url: "https://example.com/frontsite.png" }],
      }),
    ).toBe("https://example.com/frontsite.png");

    expect(getPosImageUrl(baseVariant)).toBe("https://example.com/legacy.png");
  });

  it("uses the first product default image when the variant has no media", () => {
    expect(
      getPosImageUrl(
        { images: [] },
        { defaultImageUrl: "https://example.com/product.png,https://example.com/second.png" },
      ),
    ).toBe("https://example.com/product.png");
  });
});

describe("findCartStockIssues", () => {
  it("reports missing and insufficient store stock", () => {
    const issues = findCartStockIssues(
      [
        { product: { _id: "variant-1", name: "Milk" }, qty: 3 },
        { product: { _id: "variant-2", name: "Bread" }, qty: 1 },
      ],
      [{ _id: "variant-1", quantityAvailable: 2 }],
    );

    expect(issues).toEqual([
      { productVariantId: "variant-1", name: "Milk", requested: 3, available: 2 },
      { productVariantId: "variant-2", name: "Bread", requested: 1, available: 0 },
    ]);
  });
});

describe("getVariantStockStatus", () => {
  it("uses the configured reorder threshold", () => {
    expect(getVariantStockStatus({ quantityAvailable: 4, reorderThreshold: 10 })).toBe("CRITICAL");
    expect(getVariantStockStatus({ quantityAvailable: 8, reorderThreshold: 10 })).toBe("LOW");
    expect(getVariantStockStatus({ quantityAvailable: 11, reorderThreshold: 10 })).toBe("HEALTHY");
  });

  it("keeps legacy bands during a rolling backend deployment", () => {
    expect(getVariantStockStatus({ quantityAvailable: 8 })).toBe("CRITICAL");
    expect(getVariantStockStatus({ quantityAvailable: 15 })).toBe("LOW");
  });
});
