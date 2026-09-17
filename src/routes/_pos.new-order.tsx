import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  getPosThumbnailUrl,
  productApi,
  type PosJoinedVariant,
  type PosCategory,
} from "@/lib/product-api";
import { useLiveCatalog } from "@/lib/use-live-catalog";
import { formatINR } from "@/lib/utils";
import { useCart, type CartProduct } from "@/lib/cart-context";
import { useAuthStore } from "@/lib/auth-store";
import { CartPanel } from "@/components/CartPanel";
import { WeightEntryDialog } from "@/components/WeightEntryDialog";
import { formatWeight } from "@/lib/weight";
import { InventoryRefreshNotice } from "@/components/inventory-refresh-notice";
import { getErrorMessage, resolvePosPageState } from "@/lib/pos-page-state";
import { Search, ScanLine, Mic, Plus, Minus, X, Bike, Package } from "lucide-react";
import { toast } from "sonner";
import { getMarkdownErrorMessage, isMarkdownCode, markdownApi } from "@/lib/markdown-api";
import { buildMarkdownCartProduct } from "@/lib/scanner-flow";

export const Route = createFileRoute("/_pos/new-order")({
  head: () => ({
    meta: [
      { title: "New Order" },
      {
        name: "description",
        content: "Fast grocery billing — search, scan, and check out in under 30 seconds.",
      },
    ],
  }),
  component: NewOrderPage,
});

const CATEGORY_COLORS = [
  "#5FAE3E",
  "#052B7B",
  "#FF7A00",
  "#E1261C",
  "#FFC928",
  "#052B7B",
  "#FF7A00",
  "#5FAE3E",
];

function getCategoryColor(idx: number) {
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

function NewOrderPage() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [catId, setCatId] = useState<string | null>(null);
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";
  const { add, activeOrderId } = useCart();

  const resolveHardwareScan = async () => {
    const code = query.trim().toUpperCase();
    if (!isMarkdownCode(code)) return;
    if (activeOrderId) {
      toast.error("Markdown stock cannot be added to a resumed held order.");
      return;
    }
    try {
      const markdown = (await markdownApi.resolveLabel(storeId, code)).data;
      const variants = await productApi.getStoreVariantStock([markdown.productVariantId], storeId);
      if (!variants[0]) throw new Error("The product for this markdown label is unavailable.");
      if (variants[0].sellingMode === "WEIGHT") {
        throw new Error("Markdown labels for manually weighed products are not supported yet.");
      }
      if (!add(buildMarkdownCartProduct(variants[0], markdown))) {
        throw new Error(`Only ${markdown.remainingQuantity} markdown units remain.`);
      }
      setQuery("");
      toast.success(`Markdown applied to ${variants[0].variantName}`);
    } catch (error) {
      toast.error(getMarkdownErrorMessage(error));
    }
  };

  const catalogQuery = useLiveCatalog("pos-catalog", storeId);

  const variants = useMemo(() => catalogQuery.data?.variants ?? [], [catalogQuery.data?.variants]);
  const searchText = useMemo(
    () =>
      new Map(
        variants.map((variant) => [
          variant._id,
          [
            variant.variantName,
            variant.productName,
            variant.brandName,
            variant.sku,
            ...variant.barcodes,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [variants],
  );
  const categories = useMemo(() => {
    const usedCatIds = new Set(variants.map((v) => v.categoryId).filter(Boolean));
    return (catalogQuery.data?.categories ?? []).filter((c) => usedCatIds.has(c._id));
  }, [catalogQuery.data?.categories, variants]);

  const filtered = useMemo(() => {
    let list = variants;
    if (catId) list = list.filter((v) => v.categoryId === catId);
    if (deferredQuery.trim()) {
      const q = deferredQuery.toLowerCase().trim();
      list = list.filter((variant) => searchText.get(variant._id)?.includes(q));
    }
    return list;
  }, [deferredQuery, catId, searchText, variants]);
  const pageState = resolvePosPageState({
    isLoading: catalogQuery.isLoading,
    isError: catalogQuery.isError,
    hasData: variants.length > 0,
  });

  return (
    <div className="flex h-full overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-[var(--brand-blue)]/20 bg-[var(--surface)] px-4 focus-within:border-[var(--brand-blue)]">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isMarkdownCode(query)) {
                    event.preventDefault();
                    void resolveHardwareScan();
                  }
                }}
                placeholder="Search product, brand or scan barcode…"
                className="tap-target w-full bg-transparent text-base font-semibold placeholder:text-muted-foreground/70 focus:outline-none"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <Link
              to="/scanner"
              className="tap-target flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-4 font-bold text-white shadow-sm active:scale-[0.97]"
            >
              <ScanLine className="h-5 w-5" /> <span className="hidden sm:inline">Scan</span>
            </Link>
            <button className="tap-target grid place-items-center rounded-xl bg-[var(--secondary)] px-4 font-bold text-foreground active:scale-[0.97]">
              <Mic className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border-b bg-card px-4 py-3">
          <div className="flex gap-2">
            <CategoryTile
              active={catId === null}
              onClick={() => setCatId(null)}
              name="All Items"
              idx={-1}
            />
            {categories.map((c, i) => (
              <CategoryTile
                key={c._id}
                active={catId === c._id}
                onClick={() => setCatId(c._id)}
                name={c.name}
                idx={i}
              />
            ))}
          </div>
        </div>

        <InventoryRefreshNotice
          error={catalogQuery.snapshotError}
          isRefreshing={catalogQuery.isInventoryRefreshing}
          onRetry={() => void catalogQuery.retryInventory()}
        />

        <div className="flex-1 overflow-y-auto p-4">
          {pageState === "loading" ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 animate-pulse" />
                <div className="mt-2 font-semibold">Loading products…</div>
              </div>
            </div>
          ) : pageState === "error" ? (
            <div className="grid h-full place-items-center text-center text-muted-foreground">
              <div className="max-w-sm">
                <Package className="mx-auto h-10 w-10 text-[var(--brand-red)]" />
                <div className="mt-3 text-lg font-extrabold text-foreground">
                  Products unavailable
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {getErrorMessage(catalogQuery.error, "Catalog could not be loaded.")}
                </p>
                <button
                  type="button"
                  onClick={() => void catalogQuery.refetch()}
                  className="mt-4 tap-target rounded-xl bg-[var(--brand-blue)] px-5 font-bold text-white"
                >
                  Retry Products
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <div className="text-5xl">🔍</div>
                <div className="mt-2 font-semibold">
                  {variants.length === 0
                    ? "No active products for this store."
                    : `No products match "${query}"`}
                </div>
              </div>
            </div>
          ) : (
            <VirtualProductGrid variants={filtered} />
          )}
        </div>
      </section>

      <CartPanel />
    </div>
  );
}

function VirtualProductGrid({ variants }: { variants: PosJoinedVariant[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(2);
  const rows = useMemo(() => {
    const result: PosJoinedVariant[][] = [];
    for (let index = 0; index < variants.length; index += columns) {
      result.push(variants.slice(index, index + columns));
    }
    return result;
  }, [columns, variants]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 340,
    overscan: 3,
    initialRect: { width: 1000, height: 700 },
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(width >= 1180 ? 5 : width >= 900 ? 4 : width >= 650 ? 3 : 2);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (variants.length <= 100) {
    return (
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        data-testid="product-grid"
      >
        {variants.map((variant) => (
          <ProductCard key={variant._id} variant={variant} />
        ))}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" data-testid="virtual-product-grid">
      <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className="absolute left-0 top-0 grid w-full gap-3 pb-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rows[virtualRow.index].map((variant) => (
              <ProductCard key={variant._id} variant={variant} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryTile({
  name,
  idx,
  active,
  onClick,
}: {
  name: string;
  idx: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = getCategoryColor(idx);
  return (
    <button
      onClick={onClick}
      className={
        "tap-target-lg shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-bold transition-all " +
        (active
          ? "text-white shadow-md"
          : "bg-[var(--secondary)] text-foreground hover:bg-[var(--secondary)]/80")
      }
      style={active ? { backgroundColor: color } : undefined}
    >
      <span className="text-[11px] leading-tight font-bold uppercase tracking-wide">{name}</span>
    </button>
  );
}

function ProductCard({ variant }: { variant: PosJoinedVariant }) {
  const { add, items } = useCart();
  const inCart = items.find((i) => i.product._id === variant._id);
  const [imgError, setImgError] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const isWeighted = variant.sellingMode === "WEIGHT";
  const outOfStock = variant.quantityAvailable !== undefined && variant.quantityAvailable <= 0;
  const atStockLimit =
    variant.quantityAvailable !== undefined &&
    Boolean(inCart) &&
    Number(inCart?.qty || 0) >= variant.quantityAvailable;
  const off =
    variant.mrp && variant.price
      ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100)
      : 0;
  const weight = isWeighted ? "Sold by weight" : `${variant.unitValue} ${variant.unitType}`;
  const cartProduct: CartProduct = {
    _id: variant._id,
    name: variant.variantName,
    weight,
    mrp: variant.mrp || variant.price,
    price: variant.price,
    imageUrl: variant.imageUrl,
    taxRate: variant.taxRate ?? 0,
    quantityAvailable: variant.quantityAvailable,
    sellingMode: variant.sellingMode,
    unitType: variant.unitType,
    unitValue: Number(variant.unitValue || 0) || undefined,
  };

  const addToCart = () => {
    if (outOfStock) {
      toast.error("Product is out of stock.");
      return;
    }
    if (atStockLimit) {
      toast.error(`Only ${variant.quantityAvailable ?? 0} available.`);
      return;
    }
    if (isWeighted) {
      setWeightDialogOpen(true);
      return;
    }
    if (!add(cartProduct)) {
      toast.error(`Only ${variant.quantityAvailable ?? 0} available.`);
    }
  };

  return (
    <>
      <button
        onClick={addToCart}
        disabled={outOfStock || atStockLimit}
        aria-label={`Add ${variant.variantName}`}
        className={
          "group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card p-3 text-left shadow-sm transition-all " +
          (outOfStock || atStockLimit
            ? "cursor-not-allowed border-muted opacity-50"
            : "border-border active:scale-[0.98] active:border-[var(--brand-blue)]")
        }
      >
        {off > 0 && !outOfStock && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-[var(--brand-red)] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            {off}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-muted-foreground px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            OUT OF STOCK
          </span>
        )}
        {atStockLimit && !outOfStock && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-muted-foreground px-1.5 py-0.5 text-[10px] font-extrabold text-white">
            MAX IN CART
          </span>
        )}
        {inCart && !outOfStock && (
          <span className="absolute right-2 top-2 z-10 grid h-7 min-w-7 place-items-center rounded-full bg-[var(--brand-green)] px-1.5 text-xs font-extrabold text-white">
            {isWeighted ? formatWeight(inCart.qty) : inCart.qty}
          </span>
        )}
        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-[var(--secondary)]">
          {!imgError && variant.imageUrl ? (
            <img
              src={getPosThumbnailUrl(variant.imageUrl)}
              alt={variant.variantName}
              loading="lazy"
              decoding="async"
              width={240}
              height={240}
              className="max-h-full max-w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <Package className="h-12 w-12 text-muted-foreground/40" />
          )}
        </div>
        <div className="mt-2 flex-1">
          <div className="line-clamp-2 text-sm font-bold leading-tight">{variant.variantName}</div>
          {variant.brandName && (
            <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
              {variant.brandName}
            </div>
          )}
          <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{weight}</div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-extrabold tabular-nums leading-none">
              {formatINR(variant.price)}
              {isWeighted ? "/kg" : ""}
            </div>
            {off > 0 && !outOfStock && (
              <div className="text-[11px] font-semibold text-muted-foreground line-through tabular-nums">
                {formatINR(variant.mrp)}
              </div>
            )}
          </div>
          {!outOfStock && !atStockLimit && (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-blue)] text-white shadow-sm">
              <Plus className="h-5 w-5" strokeWidth={3} />
            </div>
          )}
        </div>
      </button>
      <WeightEntryDialog
        open={weightDialogOpen}
        productName={variant.variantName}
        pricePerKg={variant.price}
        availableKg={
          variant.quantityAvailable === undefined
            ? undefined
            : Math.max(0, variant.quantityAvailable - (inCart?.qty || 0))
        }
        onClose={() => setWeightDialogOpen(false)}
        onConfirm={(kilograms, enteredQuantity) => {
          if (!add(cartProduct, kilograms, enteredQuantity)) {
            toast.error(`Only ${formatWeight(variant.quantityAvailable ?? 0)} is available.`);
            return;
          }
          setWeightDialogOpen(false);
          toast.success(`Added ${formatWeight(kilograms)} of ${variant.variantName}`);
        }}
      />
    </>
  );
}
