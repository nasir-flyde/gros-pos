import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, formatINR } from "@/lib/pos-data";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  AlertTriangle,
  XCircle,
  Clock,
  Truck,
  Sparkles,
  CheckSquare,
  Save,
  Send,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/_pos/request-stock")({
  head: () => ({ meta: [{ title: "Request Stock — CHOTA BAZAAR" }] }),
  component: RequestStockPage,
});

type Row = {
  id: string;
  name: string;
  sku: string;
  brand?: string;
  category: string;
  emoji: string;
  current: number;
  min: number;
  suggested: number;
  qty: number;
  price: number;
  priority: "urgent" | "high" | "normal";
};

const PRIORITY_STYLES: Record<Row["priority"], { bg: string; label: string; dot: string }> = {
  urgent: { bg: "#E1261C", label: "Urgent", dot: "🔴" },
  high: { bg: "#FF7A00", label: "High", dot: "🟠" },
  normal: { bg: "#5FAE3E", label: "Normal", dot: "🟢" },
};

function buildRows(): Row[] {
  return PRODUCTS.map((p) => {
    const min = 25;
    const suggested = Math.max(0, min * 2 - p.stock);
    const priority: Row["priority"] = p.stock < 10 ? "urgent" : p.stock < 20 ? "high" : "normal";
    return {
      id: p.id,
      name: p.name,
      sku: p.barcode.slice(-6),
      brand: p.brand,
      category: p.category,
      emoji: p.emoji,
      current: p.stock,
      min,
      suggested,
      qty: suggested,
      price: p.price,
      priority,
    };
  }).sort((a, b) => a.current - b.current);
}

function RequestStockPage() {
  const [rows, setRows] = useState<Row[]>(buildRows);
  const [priority, setPriority] = useState<"urgent" | "high" | "normal">("high");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.current < 20).map((r) => r.id)),
  );

  const updateQty = (id: string, qty: number) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, qty: Math.max(0, qty) } : r)));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectLow = () =>
    setSelected(new Set(rows.filter((r) => r.current < 20 && r.current >= 10).map((r) => r.id)));
  const selectOut = () => setSelected(new Set(rows.filter((r) => r.current < 10).map((r) => r.id)));
  const regenerate = () => setRows((rs) => rs.map((r) => ({ ...r, qty: r.suggested })));

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const totalUnits = selectedRows.reduce((s, r) => s + r.qty, 0);
  const totalValue = selectedRows.reduce((s, r) => s + r.qty * r.price, 0);

  const lowCount = rows.filter((r) => r.current < 20 && r.current >= 10).length;
  const outCount = rows.filter((r) => r.current < 10).length;

  const breakdown = useMemo(() => {
    const m = new Map<string, { units: number; value: number }>();
    selectedRows.forEach((r) => {
      const cur = m.get(r.category) ?? { units: 0, value: 0 };
      m.set(r.category, { units: cur.units + r.qty, value: cur.value + r.qty * r.price });
    });
    return [...m.entries()];
  }, [selectedRows]);

  const reqNo = "REQ-2026-04188";
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b-2 bg-[var(--surface)] px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/inventory"
              className="tap-target grid place-items-center rounded-xl border-2 bg-white px-3 font-bold"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold leading-tight">Request Stock</h1>
              <div className="text-xs font-semibold text-muted-foreground">
                CB Gurgaon Sector 56 · {reqNo} · {today}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Priority
            </div>
            {(["urgent", "high", "normal"] as const).map((p) => {
              const ps = PRIORITY_STYLES[p];
              const active = priority === p;
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="tap-target rounded-xl px-4 text-sm font-extrabold transition-all"
                  style={{
                    backgroundColor: active ? ps.bg : "var(--secondary)",
                    color: active ? "#fff" : "var(--ink)",
                    boxShadow: active ? `0 4px 0 ${ps.bg}66` : "none",
                  }}
                >
                  {ps.dot} {ps.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={XCircle}
            color="var(--brand-red)"
            label="Out Of Stock"
            value={outCount}
            sub="critical SKUs"
          />
          <Kpi
            icon={AlertTriangle}
            color="var(--brand-orange)"
            label="Low Stock"
            value={lowCount}
            sub="below minimum"
          />
          <Kpi
            icon={Clock}
            color="var(--brand-blue)"
            label="Pending Requests"
            value={4}
            sub="awaiting WH"
          />
          <Kpi
            icon={Truck}
            color="var(--brand-green)"
            label="Incoming Stock"
            value={2}
            sub="ETA today 4 pm"
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_320px] overflow-hidden">
        {/* Main */}
        <div className="flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b bg-[var(--surface)] px-5 py-2.5">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Suggested Replenishment · {rows.length} SKUs
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={selectOut}
                className="tap-target rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white"
              >
                <CheckSquare className="mr-1.5 inline h-4 w-4" /> Select Out Of Stock
              </button>
              <button
                onClick={selectLow}
                className="tap-target rounded-xl bg-[var(--brand-orange)] px-4 text-sm font-extrabold text-white"
              >
                <CheckSquare className="mr-1.5 inline h-4 w-4" /> Select Low Stock
              </button>
              <button
                onClick={regenerate}
                className="tap-target rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white"
              >
                <Sparkles className="mr-1.5 inline h-4 w-4" /> Generate Suggested
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--secondary)] text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-2 py-3 text-left">Product</th>
                  <th className="px-2 py-3 text-left">SKU</th>
                  <th className="px-2 py-3 text-right">Stock</th>
                  <th className="px-2 py-3 text-right">Min</th>
                  <th className="px-2 py-3 text-right">Suggested</th>
                  <th className="px-2 py-3 text-center">Request Qty</th>
                  <th className="px-2 py-3 text-center">Quick</th>
                  <th className="px-2 py-3 text-left">Priority</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSel = selected.has(r.id);
                  const ps = PRIORITY_STYLES[r.priority];
                  return (
                    <tr
                      key={r.id}
                      className={
                        "border-b transition-colors " + (isSel ? "bg-[#FFFCEC]" : "bg-white")
                      }
                    >
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggle(r.id)}
                          className="grid h-8 w-8 place-items-center rounded-md border-2"
                          style={{
                            borderColor: isSel ? "var(--brand-blue)" : "var(--border)",
                            backgroundColor: isSel ? "var(--brand-blue)" : "white",
                          }}
                        >
                          {isSel && <CheckSquare className="h-5 w-5 text-white" />}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-2xl">
                            {r.emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-extrabold leading-tight">{r.name}</div>
                            <div className="text-[11px] font-semibold text-muted-foreground">
                              {r.brand ?? "Generic"} · {r.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs font-semibold">#{r.sku}</td>
                      <td className="px-2 py-2 text-right">
                        <span
                          className="rounded-md px-2 py-1 text-base font-extrabold tabular-nums"
                          style={{
                            color:
                              r.current < 10
                                ? "var(--brand-red)"
                                : r.current < 20
                                  ? "var(--brand-orange)"
                                  : "var(--ink)",
                          }}
                        >
                          {r.current}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-muted-foreground">
                        {r.min}
                      </td>
                      <td className="px-2 py-2 text-right text-base font-extrabold tabular-nums text-[var(--brand-blue)]">
                        {r.suggested}
                      </td>
                      <td className="px-2 py-2">
                        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-2xl border-2 bg-white p-1">
                          <button
                            onClick={() => updateQty(r.id, r.qty - 1)}
                            className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--secondary)] active:scale-95"
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                          <div className="w-14 text-center text-xl font-extrabold tabular-nums">
                            {r.qty}
                          </div>
                          <button
                            onClick={() => updateQty(r.id, r.qty + 1)}
                            className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-blue)] text-white active:scale-95"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-center gap-1">
                          {[10, 25, 50, 100].map((n) => (
                            <button
                              key={n}
                              onClick={() => updateQty(r.id, r.qty + n)}
                              className="h-11 min-w-[44px] rounded-lg bg-[var(--secondary)] px-1.5 text-xs font-extrabold active:bg-[var(--brand-blue)] active:text-white"
                            >
                              +{n}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase text-white"
                          style={{ backgroundColor: ps.bg }}
                        >
                          {ps.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right summary */}
        <aside className="flex flex-col overflow-y-auto border-l-2 bg-[var(--surface)] p-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Request Summary
          </h2>
          <div className="mt-2 rounded-2xl bg-[var(--brand-blue)] p-4 text-white">
            <div className="text-[11px] font-bold uppercase opacity-70">Total Value</div>
            <div className="text-3xl font-extrabold tabular-nums">{formatINR(totalValue)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="rounded-lg bg-white/10 p-2">
                <div className="opacity-70">Products</div>
                <div className="text-lg font-extrabold tabular-nums">{selectedRows.length}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="opacity-70">Units</div>
                <div className="text-lg font-extrabold tabular-nums">{totalUnits}</div>
              </div>
            </div>
          </div>

          <h3 className="mt-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Category Breakdown
          </h3>
          <div className="mt-2 space-y-1.5">
            {breakdown.length === 0 && (
              <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs font-semibold text-muted-foreground">
                Select items to see breakdown
              </div>
            )}
            {breakdown.map(([cat, v]) => (
              <div
                key={cat}
                className="flex items-center justify-between rounded-xl bg-[var(--secondary)] px-3 py-2 text-sm"
              >
                <span className="font-bold capitalize">{cat.replace("-", " & ")}</span>
                <span className="font-extrabold tabular-nums">
                  {v.units}u · {formatINR(v.value)}
                </span>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Estimated Refill Coverage
          </h3>
          <div className="mt-2 rounded-2xl border-2 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">Days Of Stock After Refill</span>
              <span className="text-3xl font-extrabold tabular-nums text-[var(--brand-green)]">
                14
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
              <div
                className="h-full rounded-full bg-[var(--brand-green)]"
                style={{ width: "78%" }}
              />
            </div>
            <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
              Based on avg. 28-day demand · 78% target coverage
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky bottom */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-t-2 bg-[var(--surface)] px-5 py-3 shadow-[0_-4px_0_var(--color-border)]">
        <div className="flex items-center gap-5">
          <Stat icon={Package} label="Products Selected" value={String(selectedRows.length)} />
          <div className="h-10 w-px bg-border" />
          <Stat label="Total Units" value={String(totalUnits)} />
          <div className="h-10 w-px bg-border" />
          <Stat label="Estimated Value" value={formatINR(totalValue)} color="var(--brand-blue)" />
        </div>
        <div className="flex gap-2">
          <button className="tap-target-lg rounded-2xl border-2 bg-white px-6 text-base font-extrabold">
            <Save className="mr-2 inline h-5 w-5" /> Save Draft
          </button>
          <button className="tap-target-lg rounded-2xl bg-[var(--brand-blue)] px-8 text-base font-extrabold text-white shadow-[0_4px_0_#031A4B]">
            <Send className="mr-2 inline h-5 w-5" /> Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Truck;
  color: string;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border-2 bg-white p-3">
      <div className="flex items-center gap-2">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-extrabold leading-none tabular-nums" style={{ color }}>
            {value}
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{sub}</div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon?: typeof Package;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className="text-xl font-extrabold tabular-nums"
          style={{ color: color ?? "var(--ink)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
