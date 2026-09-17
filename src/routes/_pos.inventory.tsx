import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getVariantStockStatus, type PosJoinedVariant, type PosCategory } from "@/lib/product-api";
import { useLiveCatalog } from "@/lib/use-live-catalog";
import { useAuthStore } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/pos-page-state";
import { formatINR } from "@/lib/utils";
import { canUsePackBreakdown } from "@/lib/inventory-conversion-flow";
import { InventoryRefreshNotice } from "@/components/inventory-refresh-notice";
import {
  TrendingUp,
  AlertTriangle,
  XCircle,
  Truck,
  ArrowLeftRight,
  FileText,
  Package,
  Loader2,
  RefreshCw,
  PackageOpen,
} from "lucide-react";

export const Route = createFileRoute("/_pos/inventory")({
  head: () => ({ meta: [{ title: "Stock" }] }),
  component: InventoryPage,
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

function InventoryPage() {
  const [catId, setCatId] = useState<string | null>(null);
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";
  const storeName = scopes.find((s) => s.type === "store")?.name ?? "Store";
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => Boolean(s.user?.isSuperAdmin));
  const canBreakDownPacks = canUsePackBreakdown(permissions, isSuperAdmin);

  const inventoryQuery = useLiveCatalog("inventory-catalog", storeId);

  const variants = inventoryQuery.data?.variants ?? [];
  const usedCatIds = new Set(variants.map((v) => v.categoryId).filter(Boolean));
  const categories = (inventoryQuery.data?.categories ?? []).filter((c) => usedCatIds.has(c._id));

  const filtered = catId ? variants.filter((v) => v.categoryId === catId) : variants;

  const out = filtered.filter((v) => {
    const status = getVariantStockStatus(v);
    return status === "OUT_OF_STOCK" || status === "CRITICAL";
  });
  const low = filtered.filter((v) => getVariantStockStatus(v) === "LOW");
  const fast = [...filtered]
    .filter((v) => getVariantStockStatus(v) === "HEALTHY")
    .sort((a, b) => (b.quantityAvailable ?? 0) - (a.quantityAvailable ?? 0))
    .slice(0, 6);

  if (inventoryQuery.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
          <div className="mt-2 font-semibold text-muted-foreground">Loading inventory…</div>
        </div>
      </div>
    );
  }

  if (inventoryQuery.isError) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-sm">
          <Package className="mx-auto h-10 w-10 text-[var(--brand-red)]" />
          <div className="mt-3 text-xl font-extrabold">Inventory unavailable</div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {getErrorMessage(inventoryQuery.error, "Store inventory could not be loaded.")}
          </p>
          <button
            type="button"
            onClick={() => void inventoryQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-5 py-3 text-sm font-extrabold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <InventoryRefreshNotice
        error={inventoryQuery.snapshotError}
        isRefreshing={inventoryQuery.isInventoryRefreshing}
        onRetry={() => void inventoryQuery.retryInventory()}
      />
      <h1 className="text-2xl font-extrabold">Store Inventory</h1>
      <p className="text-sm font-semibold text-muted-foreground">Quick view · {storeName}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Action
          to="/request-stock"
          color="var(--brand-blue)"
          icon={Truck}
          label="Request Stock"
          detail="Create live warehouse-to-store stock requests"
        />
        {canBreakDownPacks && (
          <Action
            to="/pack-breakdown"
            color="#6D28D9"
            icon={PackageOpen}
            label="Pack Breakdown"
            detail="Turn packed stock into sellable loose inventory"
          />
        )}
        <Action
          to="/transfer-stock"
          color="var(--brand-orange)"
          icon={ArrowLeftRight}
          label="Transfer Stock"
          detail="Instant store transfers with recent movement history"
        />
        <Action
          to="/purchase-request"
          color="var(--brand-green)"
          icon={FileText}
          label="Purchase Planning"
          detail="Vendor planning view from live low-stock catalog data"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-2">
          <CategoryChip label="All" active={catId === null} onClick={() => setCatId(null)} />
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
      <Section
        title="Fast Moving Today"
        icon={TrendingUp}
        accent="var(--brand-green)"
        items={fast}
      />
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
  detail,
  color,
  to,
}: {
  icon: typeof Truck;
  label: string;
  detail: string;
  color: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="tap-target-lg rounded-2xl px-4 py-4 text-white active:scale-[0.98]"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-center gap-2 text-base font-extrabold">
        <Icon className="h-5 w-5" /> {label}
      </div>
      <div className="mt-1 text-xs font-semibold text-white/85">{detail}</div>
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
          {weight}
          {off > 0 ? ` · ${formatINR(variant.price)}` : ""}
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
