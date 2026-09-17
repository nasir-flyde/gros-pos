import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { useLiveCatalog } from "@/lib/use-live-catalog";
import { useAuthStore } from "@/lib/auth-store";
import { formatINR } from "@/lib/utils";
import { fetchAndPrintOrderReceipt } from "@/lib/order-receipt";
import { getErrorMessage } from "@/lib/pos-page-state";
import {
  buildAverageBasket,
  buildInventoryAlertCounts,
  buildPaymentTotals,
  buildPendingFulfillmentCounts,
} from "@/lib/report-metrics";
import {
  AlertTriangle,
  Bike,
  IndianRupee,
  Loader2,
  Package2,
  Printer,
  RotateCcw,
  ScanLine,
  ShoppingCart,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  UserSearch,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_pos/")({
  head: () => ({
    meta: [
      { title: "POS Home" },
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
  { to: "/orders", label: "Orders", icon: Wallet, color: "var(--brand-red)" },
];

function HomePage() {
  const scopes = useAuthStore((s) => s.scopes);
  const user = useAuthStore((s) => s.user);
  const storeId = scopes.find((s) => s.type === "store")?.id;
  const storeName = scopes.find((s) => s.type === "store")?.name ?? "Store";
  const cashierName = user ? `${user.firstName} ${user.lastName}` : "Cashier";
  const businessDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateFrom = useMemo(
    () => new Date(`${businessDate}T00:00:00`).toISOString(),
    [businessDate],
  );
  const dateTo = useMemo(() => new Date(`${businessDate}T23:59:59`).toISOString(), [businessDate]);

  const summaryQuery = useQuery({
    queryKey: ["order-summary", storeId, dateFrom, dateTo],
    queryFn: () => orderApi.getSummary({ storeId, dateFrom, dateTo }),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const recentOrdersQuery = useQuery({
    queryKey: ["recent-orders", storeId, dateFrom, dateTo],
    queryFn: () =>
      orderApi.list({
        limit: 100,
        dateFrom,
        dateTo,
        ...(storeId ? { storeId } : {}),
      }),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const queueQuery = useQuery({
    queryKey: ["homepage-fulfillment-queue", storeId],
    queryFn: () =>
      orderApi.list({
        limit: 100,
        ...(storeId ? { storeId } : {}),
      }),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  const inventoryQuery = useLiveCatalog("homepage-inventory-alerts", storeId);

  const recentOrders = useMemo(
    () =>
      ((recentOrdersQuery.data?.data ?? []) as PosOrder[]).filter(
        (order) => order.orderType === "POS",
      ),
    [recentOrdersQuery.data?.data],
  );
  const displayedRecentOrders = recentOrders.slice(0, 20);
  const queueOrders = useMemo(
    () => (queueQuery.data?.data ?? []) as PosOrder[],
    [queueQuery.data?.data],
  );
  const inventoryVariants = useMemo(
    () => inventoryQuery.data?.variants ?? [],
    [inventoryQuery.data?.variants],
  );
  const summary = summaryQuery.data?.data;
  const todaySales = summary?.revenue ?? 0;
  const completedToday = summary?.completedOrders ?? 0;
  const paymentTotals = useMemo(() => buildPaymentTotals(recentOrders), [recentOrders]);
  const avgBasket = buildAverageBasket(summary?.averageOrderValue, todaySales, completedToday);
  const pendingCounts = useMemo(() => buildPendingFulfillmentCounts(queueOrders), [queueOrders]);
  const inventoryAlerts = useMemo(
    () => buildInventoryAlertCounts(inventoryVariants),
    [inventoryVariants],
  );
  const kpis = [
    {
      label: "Today's Sales",
      value: formatINR(todaySales),
      subtitle: "Revenue booked today",
      icon: TrendingUp,
      color: "var(--brand-green)",
    },
    {
      label: "Orders Processed",
      value: completedToday.toString(),
      subtitle: "Completed POS orders today",
      icon: ShoppingBag,
      color: "var(--brand-blue)",
    },
    {
      label: "Pending Deliveries",
      value: pendingCounts.pendingDeliveries.toString(),
      subtitle: "Active home-delivery queue",
      icon: Bike,
      color: "var(--brand-orange)",
    },
    {
      label: "Pending Pickups",
      value: pendingCounts.pendingPickups.toString(),
      subtitle: "Ready / in-progress pickups",
      icon: Package2,
      color: "var(--brand-blue)",
    },
    {
      label: "Cash Collected",
      value: formatINR(paymentTotals.cashCollected),
      subtitle: "Cash payments today",
      icon: IndianRupee,
      color: "var(--brand-green)",
    },
    {
      label: "Online Payments",
      value: formatINR(paymentTotals.onlinePayments),
      subtitle: "UPI + Card + Wallet",
      icon: Smartphone,
      color: "var(--brand-blue)",
    },
    {
      label: "Inventory Alerts",
      value: inventoryAlerts.totalAlerts.toString(),
      subtitle: `${inventoryAlerts.criticalCount} critical · ${inventoryAlerts.lowCount} low`,
      icon: AlertTriangle,
      color: "var(--brand-red)",
    },
    {
      label: "Avg Basket",
      value: formatINR(avgBasket),
      subtitle: "Average order value today",
      icon: Wallet,
      color: "var(--brand-orange)",
    },
  ] as const;
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

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <HomeQueryNotice
          label="Sales summary"
          isError={summaryQuery.isError}
          error={summaryQuery.error}
          isRefreshing={summaryQuery.isFetching && Boolean(summaryQuery.data)}
          onRetry={() => void summaryQuery.refetch()}
        />
        <HomeQueryNotice
          label="Inventory alerts"
          isError={inventoryQuery.isError || Boolean(inventoryQuery.snapshotError)}
          error={inventoryQuery.isError ? inventoryQuery.error : inventoryQuery.snapshotError}
          isRefreshing={
            (inventoryQuery.isFetching || inventoryQuery.isInventoryRefreshing) &&
            Boolean(inventoryQuery.data)
          }
          onRetry={() => void inventoryQuery.refetch()}
        />
        <HomeQueryNotice
          label="Fulfillment queue"
          isError={queueQuery.isError}
          error={queueQuery.error}
          isRefreshing={queueQuery.isFetching && Boolean(queueQuery.data)}
          onRetry={() => void queueQuery.refetch()}
        />
        <HomeQueryNotice
          label="Recent orders"
          isError={recentOrdersQuery.isError}
          error={recentOrdersQuery.error}
          isRefreshing={recentOrdersQuery.isFetching && Boolean(recentOrdersQuery.data)}
          onRetry={() => void recentOrdersQuery.refetch()}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((kpi) => (
          <KPI
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
            color={kpi.color}
          />
        ))}
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
          {recentOrdersQuery.isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
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
              {displayedRecentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {recentOrdersQuery.isLoading
                      ? "Loading..."
                      : recentOrdersQuery.isError
                        ? "Recent orders could not be loaded."
                        : "No orders yet today."}
                  </td>
                </tr>
              ) : (
                displayedRecentOrders.map((o) => (
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
                        {o.paymentMode || "—"}
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

function HomeQueryNotice({
  label,
  isError,
  error,
  isRefreshing,
  onRetry,
}: {
  label: string;
  isError: boolean;
  error: unknown;
  isRefreshing: boolean;
  onRetry: () => void;
}) {
  if (!isError && !isRefreshing) return null;

  return (
    <div
      className={
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-bold " +
        (isError
          ? "border-[var(--brand-red)]/30 bg-[var(--brand-red)]/5 text-[var(--brand-red)]"
          : "bg-[var(--secondary)] text-muted-foreground")
      }
    >
      <span>
        {label}:{" "}
        {isError
          ? getErrorMessage(error, "Unable to refresh this section.")
          : "Refreshing live data..."}
      </span>
      {isError ? (
        <button type="button" onClick={onRetry} className="shrink-0 underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function KPI({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: typeof TrendingUp;
  color: string;
}) {
  return (
    <div className="rounded-2xl border-2 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ backgroundColor: color + "20" }}
        >
          <Icon className="h-5 w-5" style={{ color }} strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
      {subtitle ? (
        <div className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  );
}
