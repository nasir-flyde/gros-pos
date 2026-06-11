import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTS, formatINR } from "@/lib/pos-data";
import { TrendingUp, AlertTriangle, XCircle, Truck, ArrowLeftRight, FileText } from "lucide-react";

export const Route = createFileRoute("/_pos/inventory")({
  head: () => ({ meta: [{ title: "Stock — CHOTA BAZAAR POS" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const out = PRODUCTS.filter((p) => p.stock < 10);
  const low = PRODUCTS.filter((p) => p.stock >= 10 && p.stock < 20);
  const fast = [...PRODUCTS].sort((a, b) => b.stock - a.stock).slice(0, 6);

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Store Inventory</h1>
      <p className="text-sm font-semibold text-muted-foreground">Quick view · ST-018 Karol Bagh</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Action color="var(--brand-blue)" icon={Truck} label="Request Stock" />
        <Action color="var(--brand-orange)" icon={ArrowLeftRight} label="Transfer Stock" />
        <Action color="var(--brand-green)" icon={FileText} label="Purchase Request" />
      </div>

      <Section title="Out of Stock / Critical" icon={XCircle} accent="var(--brand-red)" items={out} />
      <Section title="Low Stock" icon={AlertTriangle} accent="var(--brand-orange)" items={low} />
      <Section title="Fast Moving Today" icon={TrendingUp} accent="var(--brand-green)" items={fast} />
    </div>
  );
}
function Action({ icon: Icon, label, color }: { icon: typeof Truck; label: string; color: string }) {
  return (
    <button
      className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white active:scale-[0.98]"
      style={{ backgroundColor: color }}
    >
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}
function Section({
  title, icon: Icon, accent, items,
}: { title: string; icon: typeof TrendingUp; accent: string; items: typeof PRODUCTS }) {
  return (
    <div className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
        <Icon className="h-4 w-4" /> {title} · {items.length}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border-2 bg-card p-3">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--secondary)] text-3xl">{p.emoji}</div>
            <div className="min-w-0">
              <div className="truncate font-extrabold leading-tight">{p.name}</div>
              <div className="text-xs font-semibold text-muted-foreground">{p.weight} · {formatINR(p.price)}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: accent }}>
                {p.stock}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">units</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
