import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { buildCashMetrics } from "@/lib/report-metrics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_pos/cash")({
  head: () => ({ meta: [{ title: "Cash Counter" }] }),
  component: CashPage,
});

function CashPage() {
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const businessDate = new Date().toISOString().slice(0, 10);
  const [actualCash, setActualCash] = useState("");
  const dateFrom = new Date(`${businessDate}T00:00:00`).toISOString();
  const dateTo = new Date(`${businessDate}T23:59:59`).toISOString();

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
  const expectedCash = metrics.completedSales - metrics.refunds;
  const actualAmount = Number(actualCash || 0);
  const variance = actualAmount - expectedCash;
  const displayCurrency = (value: number) =>
    `₹${Math.round(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const closeCounterMutation = useMutation({
    mutationFn: () =>
      orderApi.closeCounter({
        storeId,
        businessDate,
        expectedAmount: expectedCash,
        actualAmount,
        variance,
      }),
    onSuccess: () => {
      toast.success("Counter closed successfully.");
    },
    onError: (error: { message?: string }) => {
      toast.error(error?.message ?? "Close counter failed.");
    },
  });

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-4xl rounded-[26px] border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-extrabold uppercase tracking-wide text-muted-foreground">
              Reconciliation
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Today only</p>
          </div>
        </div>

        {cashOrdersQuery.isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <MetricCard
              label="Expected"
              value={displayCurrency(expectedCash)}
              className="bg-[#ebe7df]"
              labelClassName="text-muted-foreground"
            />

            <div className="rounded-[22px] bg-[#fff4e8] px-4 py-4">
              <div className="text-sm font-extrabold uppercase tracking-wide text-[var(--brand-orange)]">
                Actual (Counted)
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={(event) => setActualCash(event.target.value)}
                placeholder="0"
                className="mt-2 h-auto border-0 bg-transparent px-0 py-0 text-4xl font-extrabold shadow-none focus-visible:ring-0"
              />
            </div>

            <MetricCard
              label="Variance"
              value={`${variance < 0 ? "- " : ""}${displayCurrency(Math.abs(variance))}`}
              className="bg-[var(--brand-green)] text-white"
              labelClassName="text-white/90"
            />

            <div className="grid gap-3 md:grid-cols-1">
              <Button
                className="h-[72px] rounded-[22px] bg-[var(--brand-blue)] text-lg font-extrabold text-white hover:bg-[var(--brand-blue)]/95"
                disabled={!storeId || actualCash.trim() === "" || closeCounterMutation.isPending}
                onClick={() => closeCounterMutation.mutate()}
              >
                {closeCounterMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Close Counter
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  className: string;
  labelClassName: string;
};

function MetricCard({ label, value, className, labelClassName }: MetricCardProps) {
  return (
    <div className={`rounded-[22px] px-4 py-4 ${className}`}>
      <div className={`text-sm font-extrabold uppercase tracking-wide ${labelClassName}`}>
        {label}
      </div>
      <div className="mt-1 text-4xl font-extrabold leading-none">{value}</div>
    </div>
  );
}
