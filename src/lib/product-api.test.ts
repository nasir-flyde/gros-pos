import { describe, expect, it } from "vitest";

import { buildJoinedMap, getEffectiveVariantPrice, getPosImageUrl } from "./product-api";

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
