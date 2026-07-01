import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { productApi, type PosJoinedVariant, type PosCategory } from "@/lib/product-api";
import { useAuthStore } from "@/lib/auth-store";
import { formatINR } from "@/lib/utils";
import { TrendingUp, AlertTriangle, XCircle, Truck, ArrowLeftRight, FileText, Package, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_pos/inventory")({
  head: () => ({ meta: [{ title: "Stock — CHHOTA BAZAAR POS" }] }),
  component: InventoryPage,
});

const CATEGORY_COLORS = [
  "#5FAE3E", "#052B7B", "#FF7A00", "#E1261C",
  "#FFC928", "#052B7B", "#FF7A00", "#5FAE3E",
];

function InventoryPage() {
  const [catId, setCatId] = useState<string | null>(null);
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";
  const storeName = scopes.find((s) => s.type === "store")?.name ?? "Store";

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-catalog", storeId],
    queryFn: () => productApi.getJoinedCatalog({ storeId }),
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const variants = data?.variants ?? [];
  const usedCatIds = new Set(variants.map((v) => v.categoryId).filter(Boolean));
  const categories = (data?.categories ?? []).filter((c) => usedCatIds.has(c._id));

  const filtered = catId ? variants.filter((v) => v.categoryId === catId) : variants;

  const out = filtered.filter((v) => (v.quantityAvailable ?? 0) < 10);
  const low = filtered.filter((v) => {
    const qty = v.quantityAvailable ?? 0;
    return qty >= 10 && qty < 20;
  });
  const fast = [...filtered]
    .filter((v) => (v.quantityAvailable ?? 0) > 0)
    .sort((a, b) => (b.quantityAvailable ?? 0) - (a.quantityAvailable ?? 0))
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
          <div className="mt-2 font-semibold text-muted-foreground">Loading inventory…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Store Inventory</h1>
      <p className="text-sm font-semibold text-muted-foreground">Quick view · {storeName}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Action to="/request-stock" color="var(--brand-blue)" icon={Truck} label="Request Stock" />
        <Action to="/transfer-stock" color="var(--brand-orange)" icon={ArrowLeftRight} label="Transfer Stock" />
        <Action to="/purchase-request" color="var(--brand-green)" icon={FileText} label="Purchase Request" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-2">
          <CategoryChip
            label="All"
            active={catId === null}
            onClick={() => setCatId(null)}
          />
          {categories.map((c, i) => (
            <CategoryChip
              key={c._id}
              label={c.name}
              active={catId === c._id}
              color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              onClick={() => setCatId(c._id)}
            />
          ))}
        </div>
      </div>

      <Section
        title="Out of Stock / Critical"
        icon={XCircle}
        accent="var(--brand-red)"
        items={out}
      />
      <Section title="Low Stock" icon={AlertTriangle} accent="var(--brand-orange)" items={low} />
      <Section title="Fast Moving Today" icon={TrendingUp} accent="var(--brand-green)" items={fast} />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "tap-target-lg shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all " +
        (active
          ? "text-white shadow-md"
          : "bg-[var(--secondary)] text-foreground hover:bg-[var(--secondary)]/80")
      }
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function Action({
  icon: Icon,
  label,
  color,
  to,
}: {
  icon: typeof Truck;
  label: string;
  color: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white active:scale-[0.98]"
      style={{ backgroundColor: color }}
    >
      <Icon className="h-5 w-5" /> {label}
    </Link>
  );
}

function Section({
  title,
  icon: Icon,
  accent,
  items,
}: {
  title: string;
  icon: typeof TrendingUp;
  accent: string;
  items: PosJoinedVariant[];
}) {
  return (
    <div className="mt-6">
      <h2
        className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide"
        style={{ color: accent }}
      >
        <Icon className="h-4 w-4" /> {title} · {items.length}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((v) => (
          <ProductCard key={v._id} variant={v} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ variant, accent }: { variant: PosJoinedVariant; accent: string }) {
  const stock = variant.quantityAvailable ?? 0;
  const weight = `${variant.unitValue} ${variant.unitType}`;
  const off =
    variant.mrp && variant.price
      ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100)
      : 0;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border-2 bg-card p-3">
      <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-[var(--secondary)]">
        {variant.imageUrl ? (
          <img
            src={variant.imageUrl}
            alt={variant.variantName}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Package className="h-7 w-7 text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-extrabold leading-tight">{variant.variantName}</div>
        <div className="text-xs font-semibold text-muted-foreground">
          {weight}{off > 0 ? ` · ${formatINR(variant.price)}` : ""}
        </div>
        {variant.brandName && (
          <div className="text-[11px] font-semibold text-muted-foreground">{variant.brandName}</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
          {stock}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          units
        </div>
      </div>
    </div>
  );
}
