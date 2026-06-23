import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { useAuthStore } from "@/lib/auth-store";
import { formatINR } from "@/lib/utils";
import { Play, Trash2, Clock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_pos/hold")({
  head: () => ({ meta: [{ title: "Held Orders — CHOTA BAZAAR POS" }] }),
  component: HoldPage,
});

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

function HoldPage() {
  const queryClient = useQueryClient();
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id;

  const { data: listRes, isLoading } = useQuery({
    queryKey: ["held-orders", storeId],
    queryFn: () =>
      orderApi.list({
        status: "HOLD",
        ...(storeId ? { storeId } : {}),
        limit: 50,
      }),
    staleTime: 10_000,
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => orderApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["held-orders"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => orderApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["held-orders"] });
    },
  });

  const orders: PosOrder[] = listRes?.data ?? [];

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Held Orders</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        {orders.length} {orders.length === 1 ? "order" : "orders"} parked for later
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <Clock className="mx-auto h-10 w-10" />
            <div className="mt-2 font-semibold">No held orders</div>
          </div>
        ) : (
          orders.map((h) => (
            <div key={h._id} className="rounded-2xl border-2 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {h.orderNumber}
                  </div>
                  <div className="text-lg font-extrabold leading-tight">
                    {h.customerId?.name || "Walk-in"}
                  </div>
                </div>
                <span className="flex items-center gap-1 rounded-md bg-[var(--brand-yellow)]/30 px-2 py-1 text-xs font-bold">
                  <Clock className="h-3 w-3" /> {fmtTime(h.createdAt)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[var(--secondary)] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Value
                  </div>
                  <div className="text-xl font-extrabold tabular-nums">
                    {formatINR(h.grandTotal)}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--secondary)] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Status
                  </div>
                  <div className="text-sm font-extrabold uppercase">{h.status}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={() => resumeMutation.mutate(h._id)}
                  disabled={resumeMutation.isPending}
                  className="tap-target-lg flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-green)] text-base font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-5 w-5" /> Resume
                    </>
                  )}
                </button>
                <button
                  onClick={() => cancelMutation.mutate(h._id)}
                  disabled={cancelMutation.isPending}
                  className="tap-target-lg grid place-items-center rounded-xl bg-[var(--brand-red)] px-4 text-white active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
