import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/pos-page-state";
import { reportApi } from "@/lib/report-api";

export const Route = createFileRoute("/_pos/reports")({
  head: () => ({ meta: [{ title: "Daily Sales Report" }] }),
  component: ReportsPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function ReportsPage() {
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const params = useMemo(
    () => ({
      storeId,
      dateFrom: new Date(`${date}T00:00:00`).toISOString(),
      dateTo: new Date(`${date}T23:59:59`).toISOString(),
    }),
    [date, storeId],
  );

  const reportsQuery = useQuery({
    queryKey: ["daily-sales-report", params],
    queryFn: () => reportApi.dailySales(params),
    enabled: Boolean(storeId),
  });
  const exportMutation = useMutation({
    mutationFn: () => reportApi.downloadDailySales(params, `daily-sales-report-${date}.csv`),
    onSuccess: () => toast.success("Daily sales report downloaded"),
    onError: (error) => toast.error(getErrorMessage(error, "Report export failed")),
  });

  const rows = useMemo(() => reportsQuery.data?.data.rows ?? [], [reportsQuery.data]);
  const metrics = useMemo(
    () => ({
      sales: rows.reduce((sum, row) => sum + Number(row.netAmount || 0), 0),
      invoices: new Set(rows.map((row) => row.invoiceNo)).size,
      units: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      gst: rows.reduce((sum, row) => sum + Number(row.gstCollected || 0), 0),
    }),
    [rows],
  );

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Daily Sales Report</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Invoice-line sales by article, SKU, and barcode.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="rounded-lg border bg-card px-3 py-2">
            <span className="block text-[11px] font-bold uppercase text-muted-foreground">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="bg-transparent font-semibold focus:outline-none"
            />
          </label>
          <button
            type="button"
            title="Download CSV"
            aria-label="Download CSV"
            disabled={exportMutation.isPending || rows.length === 0}
            onClick={() => exportMutation.mutate()}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-blue)] text-white disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {reportsQuery.isLoading ? (
        <div className="mt-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : reportsQuery.isError ? (
        <div className="mt-10 border-2 border-[var(--brand-red)]/30 bg-card p-8 text-center">
          <div className="font-extrabold">Report unavailable</div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {getErrorMessage(reportsQuery.error, "Daily sales report could not be loaded.")}
          </p>
          <button
            type="button"
            onClick={() => void reportsQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-blue)] px-5 py-3 text-sm font-extrabold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Net Sales", inr(metrics.sales)],
              ["Invoices", String(metrics.invoices)],
              ["Units", String(metrics.units)],
              ["GST", inr(metrics.gst)],
            ].map(([label, value]) => (
              <div key={label} className="border-2 bg-card p-4">
                <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto border-2 bg-card">
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-[var(--secondary)] text-xs font-bold uppercase text-muted-foreground">
                <tr>
                  {[
                    "Invoice",
                    "Store",
                    "Article ID",
                    "SKU",
                    "Barcode",
                    "Variant",
                    "Category",
                    "Qty",
                    "MRP",
                    "Discount",
                    "Net",
                    "GST",
                    "Receipt Mode",
                  ].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-3 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-semibold">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                      No sales found for this date.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.invoiceNo}-${row.articleId}-${index}`} className="border-t">
                      <td className="whitespace-nowrap px-3 py-3 font-extrabold">
                        {row.invoiceNo}
                      </td>
                      <td className="px-3 py-3">{row.storeCode || "-"}</td>
                      <td
                        className="max-w-40 truncate px-3 py-3 font-mono text-xs"
                        title={row.articleId}
                      >
                        {row.articleId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{row.sku || "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono">
                        {row.primaryBarcode || "-"}
                      </td>
                      <td className="px-3 py-3">{row.variantName || row.itemDescription}</td>
                      <td className="px-3 py-3">{row.itemCategoryCode}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.quantity}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(row.mrp)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(row.lineDiscount)}</td>
                      <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                        {inr(row.netAmount)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {inr(row.gstCollected || 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{row.modeOfReceipt}</td>
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
