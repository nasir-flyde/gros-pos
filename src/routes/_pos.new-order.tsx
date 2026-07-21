import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { productApi, type PosJoinedVariant, type PosCategory } from "@/lib/product-api";
import { formatINR } from "@/lib/utils";
import { useCart, type CartProduct } from "@/lib/cart-context";
import { useAuthStore } from "@/lib/auth-store";
import { CartPanel } from "@/components/CartPanel";
import { Search, ScanLine, Mic, Plus, Minus, X, Bike, Package } from "lucide-react";

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
  const [catId, setCatId] = useState<string | null>(null);
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["pos-catalog", storeId],
    queryFn: () => productApi.getJoinedCatalog({ storeId }),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const variants = data?.variants ?? [];
  const usedCatIds = new Set(variants.map((v) => v.categoryId).filter(Boolean));
  const categories = (data?.categories ?? []).filter((c) => usedCatIds.has(c._id));

  const filtered = useMemo(() => {
    let list = variants;
    if (catId) list = list.filter((v) => v.categoryId === catId);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (v) =>
          v.variantName.toLowerCase().includes(q) ||
          v.productName.toLowerCase().includes(q) ||
          v.barcode.includes(q) ||
          v.barcodes.some((b) => b.includes(q)) ||
          v.brandName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [query, catId, variants]);

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

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 animate-pulse" />
                <div className="mt-2 font-semibold">Loading products…</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <div className="text-5xl">🔍</div>
                <div className="mt-2 font-semibold">No products match "{query}"</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((v) => (
                <ProductCard key={v._id} variant={v} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CartPanel />
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
  const outOfStock = variant.quantityAvailable !== undefined && variant.quantityAvailable <= 0;
  const off =
    variant.mrp && variant.price
      ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100)
      : 0;
  const weight = `${variant.unitValue} ${variant.unitType}`;

  const addToCart = () => {
    if (outOfStock) return;
    const cartProduct: CartProduct = {
      _id: variant._id,
      name: variant.variantName,
      weight,
      mrp: variant.mrp,
      price: variant.price,
      imageUrl: variant.imageUrl,
      taxRate: variant.taxRate ?? 0,
    };
    add(cartProduct);
  };

  return (
    <button
      onClick={addToCart}
      disabled={outOfStock}
      className={
        "group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-card p-3 text-left shadow-sm transition-all " +
        (outOfStock
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
      {inCart && !outOfStock && (
        <span className="absolute right-2 top-2 z-10 grid h-7 min-w-7 place-items-center rounded-full bg-[var(--brand-green)] px-1.5 text-xs font-extrabold text-white">
          {inCart.qty}
        </span>
      )}
      <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-[var(--secondary)]">
        {!imgError && variant.imageUrl ? (
          <img
            src={variant.imageUrl}
            alt={variant.variantName}
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
          </div>
          {off > 0 && !outOfStock && (
            <div className="text-[11px] font-semibold text-muted-foreground line-through tabular-nums">
              {formatINR(variant.mrp)}
            </div>
          )}
        </div>
        {!outOfStock && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-blue)] text-white shadow-sm">
            <Plus className="h-5 w-5" strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
}
