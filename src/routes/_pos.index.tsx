import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { useAuthStore } from "@/lib/auth-store";
import { formatINR } from "@/lib/utils";
import {
  ShoppingCart,
  Bike,
  ShoppingBag,
  ScanLine,
  RotateCcw,
  UserSearch,
  TrendingUp,
  Package2,
  Wallet,
  IndianRupee,
  Smartphone,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_pos/")({
  head: () => ({
    meta: [
      { title: "POS Home — CHHOTA BAZAAR" },
      {
        name: "description",
        content: "Live store operations dashboard for cashiers and store managers.",
      },
    ],
  }),
  component: HomePage,
});

const QUICK_ACTIONS = [
  { to: "/new-order", label: "New Order", icon: ShoppingCart, color: "var(--brand-green)" },
  { to: "/scanner", label: "Scan", icon: ScanLine, color: "var(--brand-blue)" },
  { to: "/customers", label: "Customers", icon: UserSearch, color: "var(--brand-orange)" },
  { to: "/hold", label: "Held Orders", icon: RotateCcw, color: "var(--brand-blue)" },
  { to: "/delivery", label: "Delivery", icon: Bike, color: "var(--brand-orange)" },
  { to: "/returns", label: "Returns", icon: Wallet, color: "var(--brand-red)" },
];

function HomePage() {
  const scopes = useAuthStore((s) => s.scopes);
  const user = useAuthStore((s) => s.user);
  const storeId = scopes.find((s) => s.type === "store")?.id;
  const storeName = scopes.find((s) => s.type === "store")?.name ?? "Store";
  const cashierName = user ? `${user.firstName} ${user.lastName}` : "Cashier";

  const { data: recentRes, isLoading } = useQuery({
    queryKey: ["recent-orders", storeId],
    queryFn: () =>
      orderApi.list({
        limit: 10,
        sort: "-createdAt",
        ...(storeId ? { storeId } : {}),
      }),
    staleTime: 15_000,
  });

  const recentOrders: PosOrder[] = recentRes?.data ?? [];

  const todaySales = recentOrders
    .filter((o) => {
      const today = new Date();
      const created = new Date(o.createdAt);
      return (
        created.getDate() === today.getDate() &&
        created.getMonth() === today.getMonth() &&
        created.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const completedToday = recentOrders.filter((o) => {
    const today = new Date();
    const created = new Date(o.createdAt);
    return (
      o.status === "COMPLETED" &&
      created.getDate() === today.getDate() &&
      created.getMonth() === today.getMonth() &&
      created.getFullYear() === today.getFullYear()
    );
  }).length;

  const paymentBreakdown = recentOrders.reduce(
    (acc, o) => {
      const mode = o.paymentMode || "OTHER";
      acc[mode] = (acc[mode] || 0) + o.grandTotal;
      return acc;
    },
    {} as Record<string, number>,
  );

  const todaySalesFormatted = formatINR(todaySales);
  const totalQty = recentOrders.length;

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Good Morning! 🌤️</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        {storeName} · {cashierName}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Today's Sales" value={todaySalesFormatted} icon={TrendingUp} color="var(--brand-green)" />
        <KPI label="Orders Today" value={completedToday.toString()} icon={ShoppingBag} color="var(--brand-blue)" />
        <KPI label="Recent Orders" value={totalQty.toString()} icon={Package2} color="var(--brand-orange)" />
        <KPI
          label="Top Payment"
          value={
            Object.entries(paymentBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
          }
          icon={IndianRupee}
          color="var(--brand-blue)"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to as "/new-order"}
            className="tap-target-lg flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-sm font-extrabold text-white shadow-sm active:scale-[0.97]"
            style={{ backgroundColor: a.color }}
          >
            <a.icon className="h-7 w-7" strokeWidth={2.5} />
            <span>{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border-2 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b bg-[var(--secondary)] px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Recent Orders</h2>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {isLoading ? "Loading…" : "No orders yet today."}
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o._id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-3 font-extrabold tabular-nums">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.customerId?.name || "Walk-in"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {o.customerId?.mobile || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-0.5 text-xs font-bold">
                        {o.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{o.deliveryType}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums">
                      {formatINR(o.grandTotal)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                      {new Date(o.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  color: string;
}) {
  return (
    <div className="rounded-2xl border-2 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: color + "20" }}>
          <Icon className="h-5 w-5" style={{ color }} strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
