import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type PosOrder } from "@/lib/order-api";
import {
  buildCashMetrics,
  buildHourlySales,
  buildPaymentBreakdown,
  buildStatusBreakdown,
} from "@/lib/report-metrics";

export const Route = createFileRoute("/_pos/reports")({
  head: () => ({ meta: [{ title: "Daily Sales Report" }] }),
  component: ReportsPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function ReportsPage() {
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const dateFrom = new Date(`${date}T00:00:00`).toISOString();
  const dateTo = new Date(`${date}T23:59:59`).toISOString();

  const reportsQuery = useQuery({
    queryKey: ["pos-reports", storeId, dateFrom, dateTo],
    queryFn: () => orderApi.list({ storeId, dateFrom, dateTo, limit: 500 }),
    enabled: !!storeId,
  });

  const orders = useMemo(
    () => ((reportsQuery.data?.data ?? []) as PosOrder[]).filter((order) => order.orderType === "POS"),
    [reportsQuery.data?.data],
  );
  const cashMetrics = useMemo(() => buildCashMetrics(orders), [orders]);
  const hourly = useMemo(() => buildHourlySales(orders).filter((point) => point.sales > 0), [orders]);
  const paymentBreakdown = useMemo(() => buildPaymentBreakdown(orders), [orders]);
  const statusBreakdown = useMemo(() => buildStatusBreakdown(orders), [orders]);

  const totalSales = orders.reduce((sum, order) => sum + order.grandTotal, 0);
  const avgBasket = orders.length > 0 ? totalSales / orders.length : 0;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Daily Sales Report</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Live order analytics for the current store.
          </p>
        </div>
        <label className="rounded-xl border bg-card px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Report Date
          </div>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="bg-transparent font-semibold focus:outline-none"
          />
        </label>
      </div>

      {reportsQuery.isLoading ? (
        <div className="mt-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total Sales", value: inr(totalSales), color: "var(--brand-green)" },
              { label: "Orders", value: String(orders.length), color: "var(--brand-blue)" },
              { label: "Avg Basket", value: inr(Math.round(avgBasket)), color: "var(--brand-orange)" },
              { label: "Refunded", value: inr(cashMetrics.refunds), color: "var(--brand-red)" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border-2 bg-card p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums" style={{ color: metric.color }}>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border-2 bg-card p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Hourly Sales
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "var(--secondary)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "2px solid var(--border)",
                        fontWeight: 700,
                      }}
                      formatter={(value: number) => inr(value)}
                    />
                    <Bar dataKey="sales" fill="var(--brand-blue)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border-2 bg-card p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Payment Mix
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentBreakdown} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--secondary)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "2px solid var(--border)",
                        fontWeight: 700,
                      }}
                      formatter={(value: number) => inr(value)}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {paymentBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={[
                            "#052B7B",
                            "#5FAE3E",
                            "#FF7A00",
                            "#E1261C",
                            "#FFC928",
                          ][index % 5]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border-2 bg-card p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Order Status Breakdown
            </h2>
            <table className="w-full text-left">
              <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Orders</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {statusBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                      No orders available yet.
                    </td>
                  </tr>
                ) : (
                  statusBreakdown.map((status) => (
                    <tr key={status.name} className="border-t">
                      <td className="py-3">{status.name}</td>
                      <td className="py-3 text-right tabular-nums">{status.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
