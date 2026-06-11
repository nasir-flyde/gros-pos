import { createFileRoute, Link } from "@tanstack/react-router";
import { RECENT_TX, formatINR } from "@/lib/pos-data";
import {
  ShoppingCart, Bike, ShoppingBag, ScanLine, RotateCcw, UserSearch,
  TrendingUp, Package2, Wallet, IndianRupee, Smartphone, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_pos/")({
  head: () => ({
    meta: [
      { title: "POS Home — CHOTA BAZAAR" },
      { name: "description", content: "Live store operations dashboard for cashiers and store managers." },
    ],
  }),
  component: HomePage,
});

const KPIS = [
  { label: "Today's Sales", value: "₹1,42,860", sub: "+18% vs yesterday", icon: TrendingUp, color: "var(--brand-green)" },
  { label: "Orders Processed", value: "189", sub: "42 in last hour", icon: ShoppingBag, color: "var(--brand-blue)" },
  { label: "Pending Deliveries", value: "12", sub: "4 unassigned", icon: Bike, color: "var(--brand-orange)" },
  { label: "Pending Pickups", value: "6", sub: "2 ready to collect", icon: Package2, color: "var(--brand-blue)" },
  { label: "Cash Collected", value: "₹48,240", sub: "Counter balance", icon: IndianRupee, color: "var(--brand-green)" },
  { label: "Online Payments", value: "₹94,620", sub: "UPI + Card + Wallet", icon: Smartphone, color: "var(--brand-blue)" },
  { label: "Inventory Alerts", value: "7", sub: "Low / out of stock", icon: AlertTriangle, color: "var(--brand-red)" },
  { label: "Avg Basket", value: "₹756", sub: "+₹42 vs yesterday", icon: Wallet, color: "var(--brand-orange)" },
];

const QUICK = [
  { to: "/new-order", label: "Walk-In Sale", icon: ShoppingCart, bg: "var(--brand-blue)" },
  { to: "/new-order?mode=delivery", label: "Delivery Order", icon: Bike, bg: "var(--brand-orange)" },
  { to: "/new-order?mode=pickup", label: "Pickup Order", icon: ShoppingBag, bg: "var(--brand-green)" },
  { to: "/scanner", label: "Scan Product", icon: ScanLine, bg: "var(--brand-red)" },
  { to: "/returns", label: "Process Return", icon: RotateCcw, bg: "var(--brand-blue)" },
  { to: "/customers", label: "Customer Lookup", icon: UserSearch, bg: "var(--brand-orange)" },
];

function HomePage() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Good afternoon, Anjali</h1>
        <p className="text-sm font-medium text-muted-foreground">
          Store running smooth · 189 orders today · 12 deliveries in queue
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </div>
                <div
                  className="grid h-9 w-9 place-items-center rounded-lg text-white"
                  style={{ backgroundColor: k.color }}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.5} />
                </div>
              </div>
              <div className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{k.value}</div>
              <div className="text-xs font-medium text-muted-foreground">{k.sub}</div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.label}
              to={q.to.split("?")[0] as "/new-order"}
              className="tap-target-lg flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center text-white shadow-sm transition-transform active:scale-[0.97]"
              style={{ backgroundColor: q.bg }}
            >
              <Icon className="h-8 w-8" strokeWidth={2.25} />
              <span className="text-sm font-bold leading-tight">{q.label}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Recent Transactions
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-[var(--secondary)] text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="text-sm font-medium">
            {RECENT_TX.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3 font-bold tabular-nums">{t.id}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.time}</td>
                <td className="px-4 py-3">{t.customer}</td>
                <td className="px-4 py-3 tabular-nums">{t.items}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-[var(--secondary)] px-2 py-1 text-xs font-bold">{t.mode}</span>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">{t.type}</td>
                <td className="px-4 py-3 text-right font-extrabold tabular-nums">{formatINR(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
