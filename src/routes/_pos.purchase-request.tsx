import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShoppingCart } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { productApi, type PosJoinedVariant } from "@/lib/product-api";

export const Route = createFileRoute("/_pos/purchase-request")({
  head: () => ({ meta: [{ title: "Purchase Request" }] }),
  component: PurchaseRequestPage,
});

function PurchaseRequestPage() {
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";

  const catalogQuery = useQuery({
    queryKey: ["purchase-request-catalog", storeId],
    queryFn: () => productApi.getJoinedCatalog({ storeId }),
    enabled: !!storeId,
  });

  const lowStock = useMemo(
    () =>
      (catalogQuery.data?.variants ?? [])
        .filter((variant) => (variant.quantityAvailable ?? 0) <= 10)
        .slice(0, 25),
    [catalogQuery.data?.variants],
  );

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Purchase Request</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Live low-stock catalog view for vendor replenishment planning.
      </p>

      <div className="mt-5 rounded-2xl border-2 bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <ShoppingCart className="h-4 w-4" />
          Low Stock Candidates
        </div>

        {catalogQuery.isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : lowStock.length === 0 ? (
          <div className="rounded-xl bg-[var(--secondary)] p-4 text-sm font-semibold text-muted-foreground">
            No low-stock variants found in the live catalog.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--secondary)] text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((variant: PosJoinedVariant) => (
                  <tr key={variant._id} className="border-t">
                    <td className="px-4 py-3 font-bold">{variant.variantName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.categoryName}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-[var(--brand-red)]">
                      {variant.quantityAvailable ?? 0}
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
            <div className="font-extrabold text-[var(--brand-orange)]">Workflow note</div>
            <p className="text-sm font-semibold text-muted-foreground">
              The backend does not yet expose a dedicated POS purchase-request workflow. This view
              now uses live stock data so staff can plan vendor replenishment without relying on
              mock catalog rows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
