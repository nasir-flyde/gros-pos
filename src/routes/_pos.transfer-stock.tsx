import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { productApi, type PosJoinedVariant } from "@/lib/product-api";
import { movementApi, type StockMovement } from "@/lib/movement-api";
import { storesApi, type PosStore } from "@/lib/store-api";
import { storeOpsApi } from "@/lib/store-ops-api";

export const Route = createFileRoute("/_pos/transfer-stock")({
  head: () => ({ meta: [{ title: "Transfer Stock — CHHOTA BAZAAR" }] }),
  component: TransferStockPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function TransferStockPage() {
  const { scopes } = useAuthStore();
  const sourceStoreId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [destinationId, setDestinationId] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});

  const catalogQuery = useQuery({
    queryKey: ["transfer-catalog", sourceStoreId],
    queryFn: () => productApi.getJoinedCatalog({ storeId: sourceStoreId }),
    enabled: !!sourceStoreId,
  });

  const storesQuery = useQuery({
    queryKey: ["transfer-stores"],
    queryFn: () => storesApi.list({ limit: 100 }),
  });
  const historyQuery = useQuery({
    queryKey: ["transfer-history", sourceStoreId],
    queryFn: () =>
      movementApi.list({
        movementType: "STORE_TO_STORE",
        sourceId: sourceStoreId,
        limit: 10,
      }),
    enabled: !!sourceStoreId,
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      storeOpsApi.instantTransfer({
        movementType: "STORE_TO_STORE",
        sourceType: "STORE",
        sourceId: sourceStoreId,
        destinationId,
        items: Object.entries(selected).map(([productVariantId, quantity]) => ({
          productVariantId,
          quantity,
        })),
        remarks: "POS transfer stock",
      }),
    onSuccess: () => {
      toast.success("Transfer submitted");
      setSelected({});
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to submit transfer");
    },
  });

  const sourceScope = scopes.find((scope) => scope.type === "store");
  const variants = catalogQuery.data?.variants ?? [];
  const destinations = ((storesQuery.data?.data ?? []) as PosStore[]).filter(
    (store) => store._id !== sourceStoreId,
  );

  const selectedItems = useMemo(
    () =>
      variants
        .filter((variant) => selected[variant._id] > 0)
        .map((variant) => ({
          ...variant,
          quantity: selected[variant._id],
        })),
    [selected, variants],
  );

  const totalUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = selectedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const history = (historyQuery.data?.data ?? []) as StockMovement[];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="rounded-2xl border-2 bg-card p-5">
        <h1 className="text-2xl font-extrabold">Transfer Stock</h1>
        <p className="text-sm font-semibold text-muted-foreground">
          Move inventory from the current store using the live instant-transfer flow.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[var(--secondary)] p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Source Store
                </div>
                <div className="mt-1 text-lg font-extrabold">
                  {sourceScope?.name || "Current store"}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--secondary)] p-4">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Destination Store
                </label>
                <select
                  value={destinationId}
                  onChange={(event) => setDestinationId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold"
                >
                  <option value="">Select destination</option>
                  {destinations.map((store) => (
                    <option key={store._id} value={store._id}>
                      {store.storeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--secondary)] text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Available</th>
                    <th className="px-4 py-3 text-right">Add</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogQuery.isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  ) : variants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        No live stock found for this store.
                      </td>
                    </tr>
                  ) : (
                    variants.map((variant: PosJoinedVariant) => (
                      <tr key={variant._id} className="border-t">
                        <td className="px-4 py-3 font-bold">{variant.variantName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{variant.sku}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {variant.quantityAvailable ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              setSelected((current) => ({
                                ...current,
                                [variant._id]: Math.min(
                                  (variant.quantityAvailable ?? 0),
                                  (current[variant._id] ?? 0) + 1,
                                ),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-xs font-extrabold text-white"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-[var(--secondary)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Transfer Cart
            </div>
            <div className="mt-2 text-lg font-extrabold">{selectedItems.length} products</div>
            <div className="mt-1 text-sm font-semibold text-muted-foreground">
              {totalUnits} units · {inr(totalValue)}
            </div>

            <div className="mt-4 space-y-2">
              {selectedItems.length === 0 ? (
                <div className="rounded-lg bg-white p-4 text-sm font-semibold text-muted-foreground">
                  Add variants to build the transfer.
                </div>
              ) : (
                selectedItems.map((item) => (
                  <div key={item._id} className="rounded-lg bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold">{item.variantName}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </div>
                      <button
                        onClick={() =>
                          setSelected((current) => {
                            const next = { ...current };
                            delete next[item._id];
                            return next;
                          })
                        }
                        className="rounded-md p-1 text-muted-foreground hover:bg-[var(--secondary)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <input
                        type="number"
                        min={1}
                        max={item.quantityAvailable ?? undefined}
                        value={item.quantity}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [item._id]: Math.max(
                              1,
                              Math.min(
                                item.quantityAvailable ?? Number(event.target.value || 1),
                                Number(event.target.value || 1),
                              ),
                            ),
                          }))
                        }
                        className="w-24 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                      />
                      <div className="font-extrabold">{inr(item.quantity * item.price)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => transferMutation.mutate()}
              disabled={!destinationId || selectedItems.length === 0 || transferMutation.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-blue)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Submit Instant Transfer
            </button>

            <div className="mt-5">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Recent Transfers
              </div>
              <div className="mt-2 space-y-2">
                {history.length === 0 ? (
                  <div className="rounded-lg bg-white p-3 text-sm font-semibold text-muted-foreground">
                    No recent store-to-store transfers from this store.
                  </div>
                ) : (
                  history.map((movement) => (
                    <div key={movement._id} className="rounded-lg bg-white p-3">
                      <div className="font-extrabold">{movement.movementNumber}</div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {movement.status} · {new Date(movement.createdAt).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
