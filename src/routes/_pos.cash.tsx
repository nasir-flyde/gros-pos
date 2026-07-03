import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { buildCashMetrics } from "@/lib/report-metrics";

export const Route = createFileRoute("/_pos/cash")({
  head: () => ({ meta: [{ title: "Cash Counter — CHHOTA BAZAAR POS" }] }),
  component: CashPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function CashPage() {
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const dateFrom = new Date(`${date}T00:00:00`).toISOString();
  const dateTo = new Date(`${date}T23:59:59`).toISOString();

  const cashOrdersQuery = useQuery({
    queryKey: ["cash-orders", storeId, dateFrom, dateTo],
    queryFn: () =>
      orderApi.list({
        storeId,
        dateFrom,
        dateTo,
        limit: 300,
      }),
    enabled: !!storeId,
  });

  const orders = useMemo(
    () =>
      ((cashOrdersQuery.data?.data ?? []) as PosOrder[]).filter(
        (order) => order.orderType === "POS" && order.paymentMode === "CASH",
      ),
    [cashOrdersQuery.data?.data],
  );
  const metrics = useMemo(() => buildCashMetrics(orders), [orders]);

  const openingCash = 0;
  const expectedBalance = metrics.completedSales - metrics.refunds;

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Cash Counter Management</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Live cash summary from completed cash orders at the current store.
      </p>
      <div className="mt-4 max-w-xs rounded-xl border bg-card px-3 py-2">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Date</div>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 w-full bg-transparent font-semibold focus:outline-none"
        />
      </div>

      {cashOrdersQuery.isLoading ? (
        <div className="mt-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border-2 bg-card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Movement
            </h2>
            <ul className="space-y-2">
              {[
                { label: "Opening Cash", value: openingCash },
                { label: "Cash Orders", value: metrics.ordersCount },
                { label: "Cash Sales", value: metrics.completedSales, emphasize: true },
                { label: "Refunded Cash", value: -metrics.refunds },
                { label: "Expected Balance", value: expectedBalance, primary: true },
              ].map((row) => (
                <li
                  key={row.label}
                  className={
                    "flex items-baseline justify-between rounded-xl p-3 " +
                    (row.primary ? "bg-[var(--brand-blue)] text-white" : "bg-[var(--secondary)]")
                  }
                >
                  <span className={"font-bold " + (row.primary ? "" : "text-muted-foreground")}>
                    {row.label}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums">
                    {row.label === "Cash Orders"
                      ? row.value
                      : `${row.value < 0 ? "– " : ""}${inr(Math.abs(row.value))}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 bg-card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Recent Cash Orders
            </h2>
            {orders.length === 0 ? (
              <div className="rounded-xl bg-[var(--secondary)] p-4 text-sm font-semibold text-muted-foreground">
                No cash orders found for this store yet.
              </div>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 8).map((order) => (
                  <div
                    key={order._id}
                    className="flex items-center justify-between rounded-xl bg-[var(--secondary)] p-3"
                  >
                    <div>
                      <div className="font-extrabold">{order.orderNumber}</div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold tabular-nums">{inr(order.grandTotal)}</div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {order.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
