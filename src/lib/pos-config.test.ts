import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  clearProtectedPosConfig,
  defaultPosConfig,
  loadProtectedPosConfig,
  loadPublicPosConfig,
  usePosConfig,
} from "./pos-config";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./api", () => ({ api: { get: mocks.get } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("tenant POS configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProtectedPosConfig();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads public branding with tenant host and gives protected POS settings precedence", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { consoleName: "Public POS" } }) });
    vi.stubGlobal("fetch", fetch);
    await loadPublicPosConfig();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/public/pos-config"), {
      headers: { "X-Tenant-Host": window.location.hostname },
    });
    mocks.get.mockResolvedValue({
      data: {
        brand: { name: "Tenant" },
        pos: {
          consoleName: "Private POS",
          primaryColor: "#123456",
          faviconUrl: "/tenant-icon.png",
        },
      },
    });
    await loadProtectedPosConfig();
    await loadPublicPosConfig();
    expect(usePosConfig.getState().config.consoleName).toBe("Private POS");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#123456");
    expect(document.querySelector('link[data-pos-favicon="true"]')?.getAttribute("href")).toBe(
      "/tenant-icon.png",
    );
    clearProtectedPosConfig();
    expect(document.querySelector('link[data-pos-favicon="true"]')).toBeNull();
  });

  it("ignores a protected response from the previous session", async () => {
    const old = deferred<unknown>();
    mocks.get.mockReturnValue(old.promise);
    const loading = loadProtectedPosConfig();
    clearProtectedPosConfig();
    old.resolve({ data: { pos: { consoleName: "Old tenant" } } });
    await loading;
    expect(usePosConfig.getState().config).toEqual(defaultPosConfig);
  });

  it("ignores a public response from the previous session", async () => {
    const old = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
    const loading = loadPublicPosConfig();
    clearProtectedPosConfig();
    old.resolve({ ok: true, json: async () => ({ data: { consoleName: "Old tenant" } }) });
    await loading;
    expect(usePosConfig.getState().config).toEqual(defaultPosConfig);
  });
});
