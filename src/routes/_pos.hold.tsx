import { createFileRoute } from "@tanstack/react-router";
import { HELD_ORDERS, formatINR } from "@/lib/pos-data";
import { Play, Trash2, Clock } from "lucide-react";

export const Route = createFileRoute("/_pos/hold")({
  head: () => ({ meta: [{ title: "Held Orders — CHOTA BAZAAR POS" }] }),
  component: HoldPage,
});

function HoldPage() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Held Orders</h1>
      <p className="text-sm font-semibold text-muted-foreground">{HELD_ORDERS.length} orders parked for later</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {HELD_ORDERS.map((h) => (
          <div key={h.id} className="rounded-2xl border-2 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{h.id}</div>
                <div className="text-lg font-extrabold leading-tight">{h.customer}</div>
              </div>
              <span className="flex items-center gap-1 rounded-md bg-[var(--brand-yellow)]/30 px-2 py-1 text-xs font-bold">
                <Clock className="h-3 w-3" /> {h.createdAt}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--secondary)] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Items</div>
                <div className="text-xl font-extrabold tabular-nums">{h.items}</div>
              </div>
              <div className="rounded-xl bg-[var(--secondary)] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Value</div>
                <div className="text-xl font-extrabold tabular-nums">{formatINR(h.value)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button className="tap-target-lg flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-green)] text-base font-extrabold text-white active:scale-[0.98]">
                <Play className="h-5 w-5" /> Resume
              </button>
              <button className="tap-target-lg grid place-items-center rounded-xl bg-[var(--brand-red)] px-4 text-white active:scale-95">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
