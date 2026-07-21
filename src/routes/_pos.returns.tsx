import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Banknote, Smartphone, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type OrderItem, type PosOrder } from "@/lib/order-api";
import { refundApi, type RefundRecord } from "@/lib/refund-api";

export const Route = createFileRoute("/_pos/returns")({
  head: () => ({ meta: [{ title: "Returns & Refunds" }] }),
  component: ReturnsPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function ReturnsPage() {
  const queryClient = useQueryClient();
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const searchParams = useMemo(() => {
    const params: Record<string, unknown> = {
      limit: 20,
      status: "COMPLETED",
    };
    if (storeId) params.storeId = storeId;
    if (query.trim()) params.search = query.trim();
    return params;
  }, [query, storeId]);

  const orderListQuery = useQuery({
    queryKey: ["return-orders", searchParams],
    queryFn: () => orderApi.list(searchParams),
    enabled: !!storeId && query.trim().length > 0,
  });

  const selectedOrderQuery = useQuery({
    queryKey: ["return-order-detail", selectedOrderId],
    queryFn: () => orderApi.getById(selectedOrderId!),
    enabled: !!selectedOrderId,
  });
  const refundsQuery = useQuery({
    queryKey: ["order-refunds", selectedOrderId],
    queryFn: () => refundApi.getByOrderId(selectedOrderId!),
    enabled: !!selectedOrderId,
    retry: false,
  });

  const selectedOrder = (selectedOrderQuery.data?.data as PosOrder | undefined) ?? null;
  const items = ((selectedOrder?.items ?? []) as OrderItem[]).filter((item) => item.quantity > 0);
  const refundableAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const previousRefunds = (refundsQuery.data?.data ?? []) as RefundRecord[];

  const refundMutation = useMutation({
    mutationFn: (refundMethod: "CASH" | "UPI" | "CARD" | "WALLET" | "STORE_CREDIT") =>
      refundApi.create({
        orderId: selectedOrderId!,
        refundAmount: refundableAmount,
        refundMethod,
        reason: "POS return",
      }),
    onSuccess: () => {
      toast.success("Refund processed");
      queryClient.invalidateQueries({ queryKey: ["return-orders"] });
      queryClient.invalidateQueries({ queryKey: ["return-order-detail", selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ["order-refunds", selectedOrderId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to process refund");
    },
  });

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Returns & Refunds</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Search a completed order by order number and refund it using live order data.
      </p>

      <div className="mt-4 flex max-w-2xl items-center gap-2 rounded-2xl border-2 border-[var(--brand-blue)]/30 bg-card px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Order number…"
          className="w-full bg-transparent text-lg font-bold focus:outline-none"
        />
      </div>

      {query.trim().length > 0 ? (
        <div className="mt-4 rounded-2xl border-2 bg-card p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Matching Orders
          </div>
          {orderListQuery.isLoading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : (orderListQuery.data?.data ?? []).length === 0 ? (
            <div className="py-4 text-sm font-semibold text-muted-foreground">
              No completed orders found for that search.
            </div>
          ) : (
            <div className="space-y-2">
              {(orderListQuery.data?.data as PosOrder[]).map((order) => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrderId(order._id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-[var(--secondary)]"
                >
                  <div>
                    <div className="font-extrabold">{order.orderNumber}</div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {order.customerId?.name || "Walk-in"} · {order.paymentMode || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold">{inr(order.grandTotal)}</div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="mt-5 rounded-2xl border-2 bg-card p-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Order {selectedOrder.orderNumber}
              </div>
              <div className="text-lg font-extrabold">
                {selectedOrder.customerId?.name || "Walk-in Customer"}
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                Purchased: {new Date(selectedOrder.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
            <span className="rounded-md bg-[var(--brand-green)]/15 px-3 py-1 text-sm font-extrabold text-[var(--brand-green)]">
              Eligible
            </span>
          </div>

          <ul className="mt-3 divide-y">
                    {items.map((item) => (
                      <li
                        key={item._id}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3"
                      >
                        <div>
                          <div className="text-base font-extrabold">
                    {(typeof item.productVariantId === "object" ? item.productVariantId?.variantName : undefined) ||
                      item.variantName ||
                      "Variant"}
                          </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {item.quantity} × {inr(item.unitPrice)}
                  </div>
                </div>
                <div className="text-base font-extrabold tabular-nums">{inr(item.lineTotal)}</div>
                <span className="flex items-center gap-1 rounded-md bg-[var(--brand-green)]/15 px-2 py-1 text-xs font-bold text-[var(--brand-green)]">
                  <CheckCircle2 className="h-4 w-4" /> Refund
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-end justify-between rounded-xl bg-[var(--secondary)] p-4">
            <span className="text-sm font-bold uppercase tracking-wide">Refundable Amount</span>
            <span className="text-2xl font-extrabold tabular-nums">{inr(refundableAmount)}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { label: "Cash Refund", method: "CASH" as const, color: "var(--brand-green)", Icon: Banknote },
              { label: "UPI Refund", method: "UPI" as const, color: "var(--brand-blue)", Icon: Smartphone },
              { label: "Card Refund", method: "CARD" as const, color: "var(--brand-blue)", Icon: Smartphone },
              { label: "Wallet Refund", method: "WALLET" as const, color: "var(--brand-red)", Icon: Wallet },
              {
                label: "Store Credit",
                method: "STORE_CREDIT" as const,
                color: "var(--brand-orange)",
                Icon: Wallet,
              },
            ].map(({ label, method, color, Icon }) => (
              <button
                key={label}
                onClick={() => refundMutation.mutate(method)}
                disabled={refundMutation.isPending}
                className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: color }}
              >
                {refundMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-[var(--secondary)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Previous Refunds
            </div>
            <div className="mt-2 space-y-2">
              {previousRefunds.length === 0 ? (
                <div className="text-sm font-semibold text-muted-foreground">
                  No previous refunds recorded for this order.
                </div>
              ) : (
                previousRefunds.map((refund) => (
                  <div key={refund._id} className="rounded-lg bg-white p-3">
                    <div className="font-extrabold">
                      {refund.refundNumber} · ₹{refund.refundAmount.toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {refund.refundMethod} · {refund.status || "PROCESSED"} ·{" "}
                      {new Date(refund.createdAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
