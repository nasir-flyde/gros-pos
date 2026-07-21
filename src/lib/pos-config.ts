import { create } from "zustand";
import { api } from "./api";

export type PosConfig = {
  organizationName: string;
  consoleName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  loginHeading: string;
  loginSubtitle: string;
  supportText: string;
};

export const defaultPosConfig: PosConfig = {
  organizationName: "GROW GRO",
  consoleName: "GROW GRO POS",
  tagline: "Fast, reliable retail checkout.",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#2E5E3E",
  accentColor: "#F97316",
  loginHeading: "Store Terminal",
  loginSubtitle: "Sign in to start your checkout shift.",
  supportText: "",
};

type PosConfigState = {
  config: PosConfig;
  setConfig: (config: Partial<PosConfig>) => PosConfig;
  resetConfig: () => void;
};

export const usePosConfig = create<PosConfigState>((set) => ({
  config: defaultPosConfig,
  setConfig: (partial) => {
    const config = { ...defaultPosConfig, ...partial };
    set({ config });
    return config;
  },
  resetConfig: () => set({ config: defaultPosConfig }),
}));

let protectedConfigLoaded = false;

export function clearProtectedPosConfig() {
  protectedConfigLoaded = false;
}

const pageLabels: Record<string, string> = {
  "/": "Home",
  "/login": "Login",
  "/new-order": "New Order",
  "/checkout": "Checkout",
  "/scanner": "Scanner",
  "/customers": "Customers",
  "/inventory": "Stock",
  "/returns": "Returns",
  "/reports": "Reports",
  "/delivery": "Delivery",
};

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => meta?.setAttribute(key, value));
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function applyPosConfig(config: PosConfig, pathname?: string) {
  if (typeof document === "undefined") return;
  const currentPath = pathname || window.location.pathname;

  const route = Object.entries(pageLabels).find(([path]) =>
    path === "/" ? currentPath === path : currentPath.startsWith(path),
  )?.[1];
  document.title = route ? `${route} — ${config.consoleName}` : config.consoleName;
  document.documentElement.style.setProperty("--brand-blue", config.primaryColor);
  document.documentElement.style.setProperty("--primary", config.primaryColor);
  document.documentElement.style.setProperty("--ring", config.primaryColor);
  document.documentElement.style.setProperty("--brand-orange", config.accentColor);
  document.documentElement.style.setProperty("--accent", config.accentColor);

  upsertMeta('meta[name="description"]', { name: "description" }, config.tagline);
  upsertMeta('meta[name="author"]', { name: "author" }, config.organizationName);
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, config.consoleName);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, config.tagline);

  const existing = document.head.querySelector<HTMLLinkElement>('link[data-pos-favicon="true"]');
  if (!config.faviconUrl) {
    existing?.remove();
    return;
  }
  const favicon = existing || document.createElement("link");
  favicon.rel = "icon";
  favicon.dataset.posFavicon = "true";
  favicon.href = config.faviconUrl;
  if (!existing) document.head.appendChild(favicon);
}

function setAndApply(config: Partial<PosConfig>) {
  const resolved = usePosConfig.getState().setConfig(config);
  if (typeof window !== "undefined") applyPosConfig(resolved);
  return resolved;
}

export async function loadPublicPosConfig() {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5002/api/v1";
  try {
    const response = await fetch(`${apiUrl}/public/pos-config`, {
      headers: { "X-Tenant-Host": window.location.hostname },
    });
    const body = await response.json();
    if (protectedConfigLoaded) return usePosConfig.getState().config;
    if (!response.ok || !body?.data) return setAndApply(defaultPosConfig);
    return setAndApply(body.data);
  } catch {
    if (protectedConfigLoaded) return usePosConfig.getState().config;
    return setAndApply(defaultPosConfig);
  }
}

export async function loadProtectedPosConfig() {
  const response = (await api.get("/site-config")) as {
    data?: {
      pos?: Partial<PosConfig>;
      brand?: Record<string, string>;
      theme?: Record<string, string>;
    };
  };
  const siteConfig = response.data || {};
  const brand = siteConfig.brand || {};
  const storeName = brand.shortName || brand.name || defaultPosConfig.organizationName;
  protectedConfigLoaded = true;
  return setAndApply({
    organizationName: brand.name || defaultPosConfig.organizationName,
    consoleName: `${storeName} POS`,
    tagline: brand.tagline || defaultPosConfig.tagline,
    logoUrl: brand.logoUrl || "",
    faviconUrl: brand.logoUrl || "",
    primaryColor: siteConfig.theme?.primaryColor || defaultPosConfig.primaryColor,
    supportText: brand.supportEmail || brand.supportPhone || "",
    ...siteConfig.pos,
  });
}
