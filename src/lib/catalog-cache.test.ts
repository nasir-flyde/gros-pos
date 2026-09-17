import { afterEach, describe, expect, it } from "vitest";

import { clearCatalogCache, readCatalogCache, writeCatalogCache } from "./catalog-cache";

describe("catalog-cache", () => {
  afterEach(async () => clearCatalogCache());

  it("persists by organization and store and clears only the requested organization", async () => {
    const data = { categories: [], variants: [] };
    await writeCatalogCache({ organizationId: "org-a", storeId: "store-1", etag: '"v1"', data });
    await writeCatalogCache({ organizationId: "org-b", storeId: "store-1", etag: '"v2"', data });

    expect((await readCatalogCache("org-a", "store-1"))?.etag).toBe('"v1"');
    await clearCatalogCache("org-a");
    expect(await readCatalogCache("org-a", "store-1")).toBeNull();
    expect((await readCatalogCache("org-b", "store-1"))?.etag).toBe('"v2"');
  });
});
