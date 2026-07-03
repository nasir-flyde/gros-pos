import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { movementApi } from "@/lib/movement-api";
import { storeOpsApi, type ReplenishmentSuggestion } from "@/lib/store-ops-api";
import { warehouseApi, type PosWarehouse } from "@/lib/warehouse-api";

export const Route = createFileRoute("/_pos/request-stock")({
  head: () => ({ meta: [{ title: "Request Stock — CHHOTA BAZAAR" }] }),
  component: RequestStockPage,
});

function RequestStockPage() {
  const queryClient = useQueryClient();
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});

  const suggestionsQuery = useQuery({
    queryKey: ["replenishment-suggestions", storeId],
    queryFn: () => storeOpsApi.getReplenishmentSuggestions(storeId),
    enabled: !!storeId,
  });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses-for-request-stock"],
    queryFn: () => warehouseApi.list({ limit: 100 }),
  });

  const suggestions = (suggestionsQuery.data?.data ?? []) as ReplenishmentSuggestion[];
  const warehouses = (warehousesQuery.data?.data ?? []) as PosWarehouse[];
  const selectedEntries = useMemo(
    () =>
      suggestions
        .filter((suggestion) => (selected[suggestion.productVariantId] ?? suggestion.suggestedQuantity) > 0)
        .map((suggestion) => ({
          ...suggestion,
          quantity: selected[suggestion.productVariantId] ?? suggestion.suggestedQuantity,
        })),
    [selected, suggestions],
  );

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!sourceWarehouseId) {
        throw new Error("Select a source warehouse first.");
      }
      if (selectedEntries.length === 0) {
        throw new Error("Select at least one replenishment line.");
      }

      const movement = await movementApi.create({
        movementType: "WAREHOUSE_TO_STORE",
        sourceType: "WAREHOUSE",
        sourceId: sourceWarehouseId,
        destinationIds: [storeId],
        remarks: "POS stock request",
      });

      for (const entry of selectedEntries) {
        await movementApi.addItem(movement.data._id, {
          productVariantId: entry.productVariantId,
          dispatch: { [storeId]: entry.quantity },
          remarks: `Requested from POS replenishment suggestion ${entry.settingId}`,
        });
      }

      return movementApi.submit(movement.data._id);
    },
    onSuccess: () => {
      toast.success("Stock request submitted");
      queryClient.invalidateQueries({ queryKey: ["replenishment-suggestions", storeId] });
      setSelected({});
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Failed to submit stock request";
      toast.error(message);
    },
  });

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Request Stock</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Live replenishment suggestions generated from store reorder settings.
      </p>

      <div className="mt-5 rounded-2xl border-2 bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <PackageCheck className="h-4 w-4" />
          Suggested Replenishment
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="rounded-xl border bg-background px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Source Warehouse
            </div>
            <select
              value={sourceWarehouseId}
              onChange={(event) => setSourceWarehouseId(event.target.value)}
              className="mt-1 w-full bg-transparent font-semibold focus:outline-none"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse._id} value={warehouse._id}>
                  {warehouse.warehouseName} ({warehouse.warehouseCode})
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => requestMutation.mutate()}
            disabled={!sourceWarehouseId || selectedEntries.length === 0 || requestMutation.isPending}
            className="rounded-xl bg-[var(--brand-blue)] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {requestMutation.isPending ? "Submitting..." : "Submit Request"}
          </button>
        </div>

        {suggestionsQuery.isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl bg-[var(--secondary)] p-4 text-sm font-semibold text-muted-foreground">
            No active reorder suggestions for this store yet. Configure reorder settings in admin to
            drive live stock requests.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--secondary)] text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">Reorder Level</th>
                  <th className="px-4 py-3 text-right">Suggested Qty</th>
                  <th className="px-4 py-3 text-right">Request Qty</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.settingId} className="border-t">
                    <td className="px-4 py-3 font-bold">{suggestion.variantName || "Variant"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{suggestion.sku || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold">{suggestion.currentStock}</td>
                    <td className="px-4 py-3 text-right">{suggestion.reorderLevel}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-[var(--brand-blue)]">
                      {suggestion.suggestedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={selected[suggestion.productVariantId] ?? suggestion.suggestedQuantity}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [suggestion.productVariantId]: Number(event.target.value || 0),
                          }))
                        }
                        className="w-24 rounded-lg border px-2 py-1 text-right font-semibold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--brand-orange)]" />
          <div>
            <div className="font-extrabold text-[var(--brand-orange)]">Operational note</div>
            <p className="text-sm font-semibold text-muted-foreground">
              This screen now submits real warehouse-to-store movement requests using existing
              backend movement flows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
