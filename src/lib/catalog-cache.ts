import type { PosCategory, PosJoinedVariant } from "@/lib/product-api";

export interface CachedPosCatalog {
  schemaVersion: 1;
  organizationId: string;
  storeId: string;
  etag?: string;
  savedAt: number;
  data: {
    version?: string;
    generatedAt?: string;
    categories: PosCategory[];
    variants: PosJoinedVariant[];
  };
}

const DB_NAME = "chhota-bazaar-pos";
const STORE_NAME = "catalogs";
const SCHEMA_VERSION = 1;
const memoryCache = new Map<string, CachedPosCatalog>();
const keyFor = (organizationId: string, storeId: string) =>
  `${organizationId}:${storeId}:v${SCHEMA_VERSION}`;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCatalogCache(organizationId: string, storeId: string) {
  const key = keyFor(organizationId, storeId);
  const memory = memoryCache.get(key);
  if (memory) return memory;
  const db = await openDatabase();
  if (!db) return null;
  return new Promise<CachedPosCatalog | null>((resolve) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      const value = request.result as CachedPosCatalog | undefined;
      if (value?.schemaVersion === SCHEMA_VERSION) memoryCache.set(key, value);
      resolve(value?.schemaVersion === SCHEMA_VERSION ? value : null);
    };
    request.onerror = () => resolve(null);
  });
}

export async function writeCatalogCache(
  entry: Omit<CachedPosCatalog, "schemaVersion" | "savedAt">,
) {
  const value: CachedPosCatalog = { ...entry, schemaVersion: SCHEMA_VERSION, savedAt: Date.now() };
  const key = keyFor(entry.organizationId, entry.storeId);
  memoryCache.set(key, value);
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

export async function clearCatalogCache(organizationId?: string) {
  for (const key of memoryCache.keys()) {
    if (!organizationId || key.startsWith(`${organizationId}:`)) memoryCache.delete(key);
  }
  const db = await openDatabase();
  if (!db) return;
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  if (!organizationId) store.clear();
  else {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${organizationId}:`)) cursor.delete();
      cursor.continue();
    };
  }
}
