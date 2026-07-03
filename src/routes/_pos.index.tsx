import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { useAuthStore } from "@/lib/auth-store";
import { formatINR } from "@/lib/utils";
import { fetchAndPrintOrderReceipt } from "@/lib/order-receipt";
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
  Printer,
} from "lucide-react";
import { toast } from "sonner";

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
  const businessDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateFrom = useMemo(() => new Date(`${businessDate}T00:00:00`).toISOString(), [businessDate]);
  const dateTo = useMemo(() => new Date(`${businessDate}T23:59:59`).toISOString(), [businessDate]);

  const { data: summaryRes } = useQuery({
    queryKey: ["order-summary", storeId, dateFrom, dateTo],
    queryFn: () => orderApi.getSummary({ storeId, dateFrom, dateTo }),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const { data: recentRes, isLoading } = useQuery({
    queryKey: ["recent-orders", storeId, dateFrom, dateTo],
    queryFn: () =>
      orderApi.list({
        limit: 20,
        dateFrom,
        dateTo,
        ...(storeId ? { storeId } : {}),
      }),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const recentOrders = useMemo(
    () => ((recentRes?.data ?? []) as PosOrder[]).filter((order) => order.orderType === "POS"),
    [recentRes?.data],
  );
  const summary = summaryRes?.data;
  const todaySales = summary?.revenue ?? 0;
  const completedToday = summary?.completedOrders ?? 0;

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
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const printReceiptMutation = useMutation({
    mutationFn: async (order: PosOrder) => {
      setPrintingOrderId(order._id);
      return fetchAndPrintOrderReceipt(order);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Receipt could not be printed.";
      toast.error(message);
    },
    onSettled: () => {
      setPrintingOrderId(null);
    },
  });

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
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => printReceiptMutation.mutate(o)}
                        disabled={printReceiptMutation.isPending && printingOrderId === o._id}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {printReceiptMutation.isPending && printingOrderId === o._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        Print
                      </button>
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
