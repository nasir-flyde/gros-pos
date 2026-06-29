import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, formatINR } from "@/lib/pos-data";
import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  Clock,
  Wallet,
  Sparkles,
  Plus,
  Minus,
  Save,
  Send,
  FileText,
  Building2,
  CheckSquare,
} from "lucide-react";

export const Route = createFileRoute("/_pos/purchase-request")({
  head: () => ({ meta: [{ title: "Purchase Request — CHHOTA BAZAAR" }] }),
  component: PurchaseRequestPage,
});

type PR = {
  id: string;
  emoji: string;
  name: string;
  brand: string;
  current: number;
  demand: number;
  qty: number;
  supplier: string;
  cost: number;
  alert: string;
};

const SUPPLIERS = [
  { name: "Amul Federation", lead: "2 days", moq: 50, terms: "Net 30", fulfill: 98 },
  { name: "Britannia Distributors", lead: "3 days", moq: 24, terms: "Net 15", fulfill: 95 },
  { name: "ITC Foods Pvt Ltd", lead: "4 days", moq: 30, terms: "Net 30", fulfill: 92 },
  { name: "HUL Direct", lead: "5 days", moq: 40, terms: "Net 45", fulfill: 97 },
  { name: "Parle Products", lead: "3 days", moq: 36, terms: "Net 20", fulfill: 94 },
];

const ROWS: PR[] = [
  {
    id: "pr1",
    emoji: "🥛",
    name: "Amul Gold Milk 1L",
    brand: "Amul",
    current: 18,
    demand: 240,
    qty: 240,
    supplier: "Amul Federation",
    cost: 56,
    alert: "Stock runs out in 2 days",
  },
  {
    id: "pr2",
    emoji: "🍞",
    name: "Britannia Bread 400g",
    brand: "Britannia",
    current: 8,
    demand: 120,
    qty: 144,
    supplier: "Britannia Distributors",
    cost: 32,
    alert: "Demand ↑ 28% this week",
  },
  {
    id: "pr3",
    emoji: "🍚",
    name: "Daawat Basmati Rice 5kg",
    brand: "Daawat",
    current: 4,
    demand: 60,
    qty: 80,
    supplier: "ITC Foods Pvt Ltd",
    cost: 480,
    alert: "Critical — reorder now",
  },
  {
    id: "pr4",
    emoji: "🌾",
    name: "Aashirvaad Atta 10kg",
    brand: "Aashirvaad",
    current: 12,
    demand: 90,
    qty: 100,
    supplier: "ITC Foods Pvt Ltd",
    cost: 420,
    alert: "Festival demand spike forecast",
  },
  {
    id: "pr5",
    emoji: "🧂",
    name: "Madhur Sugar 1kg",
    brand: "Madhur",
    current: 22,
    demand: 180,
    qty: 200,
    supplier: "ITC Foods Pvt Ltd",
    cost: 42,
    alert: "Below safety stock",
  },
  {
    id: "pr6",
    emoji: "🛢️",
    name: "Fortune Sunflower Oil 5L",
    brand: "Fortune",
    current: 6,
    demand: 48,
    qty: 60,
    supplier: "ITC Foods Pvt Ltd",
    cost: 720,
    alert: "Stock out in 3 days",
  },
  {
    id: "pr7",
    emoji: "🍪",
    name: "Parle-G Biscuits 250g",
    brand: "Parle",
    current: 32,
    demand: 360,
    qty: 400,
    supplier: "Parle Products",
    cost: 22,
    alert: "Fast moving · MOQ optimized",
  },
  {
    id: "pr8",
    emoji: "🥤",
    name: "Coca-Cola 750ml × 24",
    brand: "Coca-Cola",
    current: 14,
    demand: 96,
    qty: 120,
    supplier: "HUL Direct",
    cost: 720,
    alert: "Weekend demand +35%",
  },
  {
    id: "pr9",
    emoji: "🧺",
    name: "Surf Excel Powder 1kg",
    brand: "Surf Excel",
    current: 11,
    demand: 72,
    qty: 80,
    supplier: "HUL Direct",
    cost: 195,
    alert: "Recommended reorder now",
  },
  {
    id: "pr10",
    emoji: "🧼",
    name: "Dove Soap 100g × 4",
    brand: "Dove",
    current: 18,
    demand: 120,
    qty: 144,
    supplier: "HUL Direct",
    cost: 240,
    alert: "Promotion live · stock up",
  },
];

function PurchaseRequestPage() {
  const [rows, setRows] = useState<PR[]>(ROWS);
  const [supplier, setSupplier] = useState(SUPPLIERS[0]);
  const [selected, setSelected] = useState<Set<string>>(new Set(ROWS.map((r) => r.id)));

  const setQty = (id: string, q: number) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, qty: Math.max(0, q) } : x)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const sel = rows.filter((r) => selected.has(r.id));
  const totalUnits = sel.reduce((s, r) => s + r.qty, 0);
  const totalValue = sel.reduce((s, r) => s + r.qty * r.cost, 0);
  const budget = 800000;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b-2 bg-[var(--surface)] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/inventory"
            className="tap-target grid place-items-center rounded-xl border-2 bg-white px-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold leading-tight">Purchase Request</h1>
            <div className="text-xs font-semibold text-muted-foreground">
              PR-2026-01142 · CB Gurgaon Sector 56 · Requested by Rajesh Khanna ·{" "}
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <span className="rounded-xl bg-[var(--brand-orange)] px-3 py-1.5 text-xs font-extrabold uppercase text-white">
            Auto-Generated
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={AlertTriangle}
            color="var(--brand-red)"
            label="Critical SKUs"
            value="14"
            sub="reorder immediately"
          />
          <Kpi
            icon={Clock}
            color="var(--brand-orange)"
            label="Projected Stockouts"
            value="9"
            sub="within 5 days"
          />
          <Kpi
            icon={TrendingUp}
            color="var(--brand-blue)"
            label="Avg Supplier Lead"
            value="3.4d"
            sub="across vendors"
          />
          <Kpi
            icon={Wallet}
            color="var(--brand-green)"
            label="Purchase Budget"
            value={formatINR(budget)}
            sub={`${formatINR(budget - totalValue)} remaining`}
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        {/* Procurement list */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-[var(--surface)] px-5 py-2.5">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Auto-Generated Procurement List · {rows.length} SKUs
            </div>
            <button className="ml-auto tap-target rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white">
              <Sparkles className="mr-1.5 inline h-4 w-4" /> Re-run Forecast
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--secondary)] text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-2 py-3 text-left">Product</th>
                  <th className="px-2 py-3 text-right">Stock</th>
                  <th className="px-2 py-3 text-right">Demand</th>
                  <th className="px-2 py-3 text-center">Purchase Qty</th>
                  <th className="px-2 py-3 text-left">Supplier</th>
                  <th className="px-2 py-3 text-right">Last Cost</th>
                  <th className="px-2 py-3 text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSel = selected.has(r.id);
                  return (
                    <tr key={r.id} className={"border-b " + (isSel ? "bg-[#FFFCEC]" : "bg-white")}>
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
                            <div className="text-[11px] font-semibold text-[var(--brand-orange)]">
                              {r.alert}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span
                          className="text-base font-extrabold tabular-nums"
                          style={{ color: r.current < 10 ? "var(--brand-red)" : "var(--ink)" }}
                        >
                          {r.current}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold tabular-nums">
                        {r.demand}/wk
                      </td>
                      <td className="px-2 py-2">
                        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-2xl border-2 bg-white p-1">
                          <button
                            onClick={() => setQty(r.id, r.qty - 10)}
                            className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--secondary)]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="w-16 text-center text-lg font-extrabold tabular-nums">
                            {r.qty}
                          </div>
                          <button
                            onClick={() => setQty(r.id, r.qty + 10)}
                            className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-blue)] text-white"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs font-bold">{r.supplier}</td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                        {formatINR(r.cost)}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-extrabold tabular-nums text-[var(--brand-blue)]">
                        {formatINR(r.qty * r.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Intelligence + Supplier + Summary */}
        <aside className="flex flex-col overflow-y-auto border-l-2 bg-[var(--surface)] p-4">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--brand-blue)]">
            <Sparkles className="h-4 w-4" /> System Recommendations
          </h2>
          <div className="mt-2 space-y-1.5">
            {[
              { c: "var(--brand-red)", t: "Daawat Rice runs out in 3 days at current pace" },
              { c: "var(--brand-orange)", t: "Cold drink demand ↑ 28% — weekend stocking advised" },
              { c: "var(--brand-blue)", t: "ITC supplier lead time stable at 4 days" },
              { c: "var(--brand-green)", t: "Bundle Parle order to hit MOQ discount tier" },
            ].map((x, i) => (
              <div
                key={i}
                className="flex gap-2 rounded-xl border-2 bg-white p-2.5 text-xs font-semibold"
              >
                <div
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: x.c }}
                />
                <span>{x.t}</span>
              </div>
            ))}
          </div>

          <h2 className="mt-5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-4 w-4" /> Supplier
          </h2>
          <select
            value={supplier.name}
            onChange={(e) => setSupplier(SUPPLIERS.find((s) => s.name === e.target.value)!)}
            className="tap-target mt-2 w-full rounded-xl border-2 bg-white px-3 text-base font-extrabold outline-none"
          >
            {SUPPLIERS.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <SupStat label="Lead Time" value={supplier.lead} />
            <SupStat label="MOQ" value={`${supplier.moq} units`} />
            <SupStat label="Payment" value={supplier.terms} />
            <SupStat
              label="Fulfillment"
              value={`${supplier.fulfill}%`}
              color="var(--brand-green)"
            />
          </div>

          <h2 className="mt-5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Purchase Summary
          </h2>
          <div className="mt-2 rounded-2xl bg-[var(--brand-blue)] p-4 text-white">
            <div className="text-[11px] font-bold uppercase opacity-70">
              Estimated Procurement Value
            </div>
            <div className="text-3xl font-extrabold tabular-nums">{formatINR(totalValue)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="rounded-lg bg-white/10 p-2">
                <div className="opacity-70">Products</div>
                <div className="text-lg font-extrabold tabular-nums">{sel.length}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="opacity-70">Total Units</div>
                <div className="text-lg font-extrabold tabular-nums">{totalUnits}</div>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-white/10 p-2 text-xs font-semibold">
              <div className="opacity-70">Expected Arrival</div>
              <div className="font-extrabold">In {supplier.lead} · by 6 PM</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky bottom */}
      <div className="flex items-center justify-end gap-2 border-t-2 bg-[var(--surface)] px-5 py-3 shadow-[0_-4px_0_var(--color-border)]">
        <div className="mr-auto text-xs font-bold text-muted-foreground">
          Budget Used:{" "}
          <span className="text-base font-extrabold tabular-nums text-[var(--brand-blue)]">
            {formatINR(totalValue)}
          </span>{" "}
          / {formatINR(budget)}
        </div>
        <button className="tap-target-lg rounded-2xl border-2 bg-white px-5 text-sm font-extrabold">
          <Save className="mr-2 inline h-5 w-5" /> Save Draft
        </button>
        <button className="tap-target-lg rounded-2xl border-2 border-[var(--brand-blue)] bg-white px-5 text-sm font-extrabold text-[var(--brand-blue)]">
          <Send className="mr-2 inline h-5 w-5" /> Send For Approval
        </button>
        <button className="tap-target-lg rounded-2xl bg-[var(--brand-green)] px-6 text-base font-extrabold text-white shadow-[0_4px_0_#3D7A28]">
          <FileText className="mr-2 inline h-5 w-5" /> Generate Purchase Request
        </button>
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
  icon: typeof Wallet;
  color: string;
  label: string;
  value: string;
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
          <div className="text-xl font-extrabold leading-none tabular-nums" style={{ color }}>
            {value}
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{sub}</div>
    </div>
  );
}

function SupStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border-2 p-2">
      <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-extrabold tabular-nums" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
