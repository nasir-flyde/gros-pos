import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  History,
  Loader2,
  Printer,
  Search,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { canPrintShelfLabels, canViewShelfLabels } from "@/lib/shelf-label-access";
import {
  buildShelfLabelItems,
  countShelfLabels,
  downloadShelfLabelPdf,
  printShelfLabelPdf,
  shelfLabelApi,
  type ShelfLabelCandidate,
  type ShelfLabelLayout,
  type ShelfLabelPrintBatch,
  type ShelfLabelReason,
  type ShelfLabelStore,
} from "@/lib/shelf-label-api";

export const Route = createFileRoute("/_pos/shelf-labels")({
  head: () => ({
    meta: [
      { title: "SEL Printing" },
      { name: "description", content: "Generate store shelf-edge and promotional labels." },
    ],
  }),
  component: ShelfLabelPage,
});

type Tab = "labels" | "history";
type Preview = { batch: ShelfLabelPrintBatch; url: string };
type ApiError = { message?: unknown; details?: { items?: unknown } };

const fieldClass =
  "h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-[var(--brand-blue)]";

const reasonOptions: Array<{ value: "ALL" | ShelfLabelReason; label: string }> = [
  { value: "ALL", label: "All suggestions" },
  { value: "PRICE_CHANGE", label: "Price changes" },
  { value: "NEW_STOCK", label: "New stock" },
  { value: "PROMOTION", label: "Promotions" },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as ApiError).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

function money(value?: number | null) {
  return value == null
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

function formatDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function ShelfLabelPage() {
  const scopes = useAuthStore((state) => state.scopes);
  const permissions = useAuthStore((state) => state.permissions);
  const isSuperAdmin = useAuthStore((state) => Boolean(state.user?.isSuperAdmin));
  const canView = canViewShelfLabels(permissions, isSuperAdmin);
  const canPrint = canPrintShelfLabels(permissions, isSuperAdmin);
  const [tab, setTab] = useState<Tab>("labels");
  const [storeId, setStoreId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<"ALL" | ShelfLabelReason>("ALL");
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<ShelfLabelLayout>("THERMAL_50X30");
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [historySearch, setHistorySearch] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const queryClient = useQueryClient();

  const scopeStores = useMemo<ShelfLabelStore[]>(
    () =>
      scopes
        .filter((scope) => scope.type === "store")
        .map((scope) => ({
          _id: scope.id,
          storeName: scope.name || "Assigned store",
          storeCode: "",
        })),
    [scopes],
  );

  const storesQuery = useQuery({
    queryKey: ["shelf-label-stores"],
    queryFn: async () => (await shelfLabelApi.stores()).data,
    enabled: canView,
    retry: false,
  });
  const stores = storesQuery.data ?? scopeStores;

  useEffect(() => {
    if (!storeId && stores.length === 1) setStoreId(stores[0]._id);
  }, [storeId, stores]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const candidatesQuery = useQuery({
    queryKey: ["shelf-label-candidates", storeId, search, reason, page],
    queryFn: () =>
      shelfLabelApi.candidates({
        storeId,
        search: search || undefined,
        reason,
        page,
        limit: 25,
      }),
    enabled: canView && tab === "labels" && Boolean(storeId),
  });

  const historyQuery = useQuery({
    queryKey: ["shelf-label-history", storeId, historySearch],
    queryFn: () =>
      shelfLabelApi.history({
        storeId: storeId || undefined,
        search: historySearch || undefined,
        limit: 50,
      }),
    enabled: canView && tab === "history",
  });

  const candidates = candidatesQuery.data?.data ?? [];
  const selectedCount = countShelfLabels(selection);
  const printableRows = candidates.filter((candidate) => candidate.printable);
  const allPageSelected =
    printableRows.length > 0 &&
    printableRows.every((candidate) => Boolean(selection[candidate.productVariantId]));

  const openBatchPreview = async (batch: ShelfLabelPrintBatch) => {
    const blob = await shelfLabelApi.pdf(batch._id);
    const url = URL.createObjectURL(blob);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { batch, url };
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Select a store first.");
      const items = buildShelfLabelItems(selection);
      if (!items.length) throw new Error("Select at least one printable product.");
      const response = await shelfLabelApi.createBatch({ storeId, layout, items });
      await openBatchPreview(response.data);
      return response;
    },
    onSuccess: (response) => {
      toast.success(`${response.data.totalLabels} labels are ready to print.`);
      setSelection({});
      void queryClient.invalidateQueries({ queryKey: ["shelf-label-history"] });
    },
    onError: (error: unknown) => {
      const details = (error as ApiError)?.details?.items;
      if (Array.isArray(details)) {
        details.forEach((item) => {
          if (typeof item === "object" && item && "message" in item) {
            toast.error(String(item.message));
          }
        });
        return;
      }
      toast.error(getErrorMessage(error, "Could not generate labels."));
    },
  });

  const previewMutation = useMutation({
    mutationFn: openBatchPreview,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Could not load the label PDF.")),
  });

  if (!canView) return <AccessDenied />;

  const clearProductSelection = () => {
    setPage(1);
    setSelection({});
  };

  const updateSelection = (candidate: ShelfLabelCandidate, checked: boolean) => {
    setSelection((current) => {
      const next = { ...current };
      if (checked) next[candidate.productVariantId] = next[candidate.productVariantId] || 1;
      else delete next[candidate.productVariantId];
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background p-4 sm:p-5">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-orange)]">
              Store pricing operations
            </p>
            <h1 className="text-2xl font-extrabold">POP / Shelf Edge Label Printing</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Print store-specific standard and promotional price labels.
            </p>
          </div>
          <label className="text-xs font-bold text-muted-foreground">
            Assigned store
            <select
              aria-label="Assigned store"
              className={`${fieldClass} mt-1 min-w-64`}
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                clearProductSelection();
              }}
            >
              <option value="">Select a store</option>
              {stores.map((store) => (
                <option key={store._id} value={store._id}>
                  {store.storeName}
                  {store.storeCode ? ` (${store.storeCode})` : ""}
                </option>
              ))}
            </select>
          </label>
        </header>

        {storesQuery.isError ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Store directory could not be refreshed. Showing stores from your current access session.
          </div>
        ) : null}

        <nav className="flex gap-2 border-b">
          <TabButton active={tab === "labels"} onClick={() => setTab("labels")} icon={Tags}>
            Create labels
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={History}>
            Print history
          </TabButton>
        </nav>

        {tab === "labels" ? (
          !storeId ? (
            <EmptyState
              icon={Printer}
              title="Select an assigned store"
              text="Prices, promotions, stock receipts, and labels are store-specific."
            />
          ) : (
            <>
              <section className="flex flex-wrap items-end gap-3 rounded-2xl border-2 bg-card p-4">
                <form
                  className="flex min-w-72 flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput.trim());
                    clearProductSelection();
                  }}
                >
                  <label className="flex-1 text-xs font-bold text-muted-foreground">
                    Product, SKU or barcode
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                      <input
                        aria-label="Product, SKU or barcode"
                        className={`${fieldClass} pl-9`}
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Scan barcode or search product"
                      />
                    </div>
                  </label>
                  <button className="mt-5 h-11 rounded-xl bg-foreground px-5 text-sm font-bold text-background">
                    Search
                  </button>
                </form>
                <label className="text-xs font-bold text-muted-foreground">
                  Suggestion reason
                  <select
                    aria-label="Suggestion reason"
                    className={`${fieldClass} mt-1 min-w-44`}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value as typeof reason);
                      clearProductSelection();
                    }}
                  >
                    {reasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-muted-foreground">
                  Print layout
                  <select
                    aria-label="Print layout"
                    className={`${fieldClass} mt-1 min-w-48`}
                    value={layout}
                    onChange={(event) => setLayout(event.target.value as ShelfLabelLayout)}
                  >
                    <option value="THERMAL_50X30">Thermal — 50 × 30 mm</option>
                    <option value="A4_50X30">A4 sheet — 36 labels</option>
                  </select>
                </label>
              </section>

              <section className="overflow-hidden rounded-2xl border-2 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[var(--secondary)] px-4 py-3">
                  <div>
                    <h2 className="font-extrabold">Suggested labels</h2>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Recent changes plus matching search results
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      disabled={!canPrint || printableRows.length === 0}
                      checked={allPageSelected}
                      onChange={(event) =>
                        setSelection((current) => {
                          const next = { ...current };
                          printableRows.forEach((row) => {
                            if (event.target.checked) next[row.productVariantId] ||= 1;
                            else delete next[row.productVariantId];
                          });
                          return next;
                        })
                      }
                    />
                    Select printable page
                  </label>
                </div>
                {candidatesQuery.isLoading ? (
                  <Loading />
                ) : candidatesQuery.isError ? (
                  <QueryError
                    message={getErrorMessage(
                      candidatesQuery.error,
                      "Could not load label suggestions.",
                    )}
                    onRetry={() => void candidatesQuery.refetch()}
                  />
                ) : candidates.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="No matching products"
                    text="Try another search or suggestion reason."
                    compact
                  />
                ) : (
                  <CandidateTable
                    candidates={candidates}
                    selection={selection}
                    canPrint={canPrint}
                    onSelectionChange={updateSelection}
                    onCopiesChange={(id, quantity) =>
                      setSelection((current) => ({ ...current, [id]: quantity }))
                    }
                  />
                )}
                <div className="flex items-center justify-between border-t px-4 py-3 text-xs font-semibold text-muted-foreground">
                  <span>{candidatesQuery.data?.meta?.totalDocs ?? 0} products</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
                      onClick={() => {
                        setPage((value) => Math.max(1, value - 1));
                        setSelection({});
                      }}
                    >
                      Previous
                    </button>
                    <span>Page {page}</span>
                    <button
                      disabled={
                        !candidatesQuery.data?.meta || page >= candidatesQuery.data.meta.totalPages
                      }
                      className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
                      onClick={() => {
                        setPage((value) => value + 1);
                        setSelection({});
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>

              <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 bg-background/95 p-4 shadow-lg backdrop-blur">
                <div>
                  <div className="font-extrabold">
                    {selectedCount} label{selectedCount === 1 ? "" : "s"} selected
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    Prices will be verified again when the batch is created.
                  </div>
                </div>
                <button
                  disabled={!canPrint || selectedCount === 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Generate preview
                </button>
              </div>
            </>
          )
        ) : (
          <HistoryTable
            storeId={storeId}
            search={historySearch}
            setSearch={setHistorySearch}
            batches={historyQuery.data?.data ?? []}
            loading={historyQuery.isLoading}
            error={historyQuery.error}
            canPrint={canPrint}
            pending={previewMutation.isPending}
            onRetry={() => void historyQuery.refetch()}
            onPreview={(batch) => previewMutation.mutate(batch)}
          />
        )}
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) {
            setPreview((current) => {
              if (current) URL.revokeObjectURL(current.url);
              return null;
            });
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {preview?.batch.batchNumber} · {preview?.batch.totalLabels} labels
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <>
              <iframe
                title="Shelf label PDF preview"
                src={preview.url}
                className="h-[65vh] w-full rounded-xl border bg-muted"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold"
                  onClick={() => downloadShelfLabelPdf(preview.url, preview.batch.batchNumber)}
                >
                  <Download className="size-4" />
                  Download PDF
                </button>
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white"
                  onClick={() => {
                    if (!printShelfLabelPdf(preview.url)) {
                      toast.error("Pop-up blocked. Use Download PDF instead.");
                    }
                  }}
                >
                  <Printer className="size-4" />
                  Open print dialog
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CandidateTable({
  candidates,
  selection,
  canPrint,
  onSelectionChange,
  onCopiesChange,
}: {
  candidates: ShelfLabelCandidate[];
  selection: Record<string, number>;
  canPrint: boolean;
  onSelectionChange: (candidate: ShelfLabelCandidate, checked: boolean) => void;
  onCopiesChange: (id: string, quantity: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs font-extrabold uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Print</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Promotion</th>
            <th className="px-4 py-3">Copies</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const checked = Boolean(selection[candidate.productVariantId]);
            return (
              <tr
                key={candidate.productVariantId}
                className={`border-t align-top ${candidate.printable ? "" : "bg-red-500/[0.03]"}`}
              >
                <td className="px-4 py-3">
                  <input
                    aria-label={`Select ${candidate.sku || candidate.productVariantId}`}
                    type="checkbox"
                    disabled={!candidate.printable || !canPrint}
                    checked={checked}
                    onChange={(event) => onSelectionChange(candidate, event.target.checked)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold">{candidate.productName || "Unavailable product"}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {candidate.variantName} · {candidate.sku}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {candidate.primaryBarcode || "No primary barcode"}
                  </div>
                  {candidate.errors?.map((error) => (
                    <div key={error} className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="size-3" />
                      {error}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-40 flex-wrap gap-1">
                    {candidate.reasons.map((item) => (
                      <ReasonBadge key={item} reason={item} />
                    ))}
                    {candidate.reasons.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Search result</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className={`font-extrabold ${candidate.promotion ? "text-red-600" : ""}`}>
                    {money(candidate.effectivePrice)}
                  </div>
                  {candidate.promotion ? (
                    <div className="text-xs text-muted-foreground line-through">
                      {money(candidate.regularPrice)}
                    </div>
                  ) : null}
                  <div className="text-[11px] text-muted-foreground">
                    MRP {money(candidate.mrp)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {candidate.promotion ? (
                    <>
                      <div className="font-bold text-red-700">{candidate.promotion.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Save {money(candidate.savings)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(candidate.promotion.startsAt)} –{" "}
                        {formatDate(candidate.promotion.endsAt)}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Standard SEL</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    aria-label={`Copies for ${candidate.sku}`}
                    type="number"
                    min={1}
                    max={500}
                    disabled={!checked}
                    className="h-10 w-20 rounded-lg border-2 bg-background px-2 font-bold"
                    value={selection[candidate.productVariantId] || 1}
                    onChange={(event) =>
                      onCopiesChange(
                        candidate.productVariantId,
                        Math.max(1, Math.min(500, Number(event.target.value) || 1)),
                      )
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({
  storeId,
  search,
  setSearch,
  batches,
  loading,
  error,
  canPrint,
  pending,
  onRetry,
  onPreview,
}: {
  storeId: string;
  search: string;
  setSearch: (value: string) => void;
  batches: ShelfLabelPrintBatch[];
  loading: boolean;
  error: unknown;
  canPrint: boolean;
  pending: boolean;
  onRetry: () => void;
  onPreview: (batch: ShelfLabelPrintBatch) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b bg-[var(--secondary)] p-4">
        <div>
          <h2 className="font-extrabold">Generated print batches</h2>
          <p className="text-xs font-semibold text-muted-foreground">
            Reprints always use the original captured prices.
          </p>
        </div>
        <label className="text-xs font-bold text-muted-foreground">
          Batch number
          <input
            aria-label="Batch number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${fieldClass} mt-1 min-w-64`}
            placeholder="Search batch"
          />
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <QueryError
          message={getErrorMessage(error, "Could not load print history.")}
          onRetry={onRetry}
        />
      ) : batches.length === 0 ? (
        <EmptyState
          icon={History}
          title="No print batches"
          text={
            storeId
              ? "Generate the first label batch for this store."
              : "Select a store or generate a label batch."
          }
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-extrabold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Layout</th>
                <th className="px-4 py-3">Labels</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch._id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{batch.batchNumber}</td>
                  <td className="px-4 py-3 font-semibold">
                    {batch.storeSnapshot.storeName}
                    <div className="text-xs text-muted-foreground">
                      {batch.storeSnapshot.storeCode}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {batch.layout === "THERMAL_50X30" ? "Thermal 50 × 30" : "A4 · 36 per page"}
                  </td>
                  <td className="px-4 py-3 font-extrabold">{batch.totalLabels}</td>
                  <td className="px-4 py-3">{formatDate(batch.generatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={!canPrint || pending}
                      onClick={() => onPreview(batch)}
                      className="inline-flex h-10 items-center gap-1 rounded-lg border-2 px-3 text-xs font-bold disabled:opacity-50"
                    >
                      <Printer className="size-3.5" />
                      Preview / reprint
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Tags;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-extrabold ${
        active
          ? "border-[var(--brand-blue)] text-[var(--brand-blue)]"
          : "border-transparent text-muted-foreground"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

function ReasonBadge({ reason }: { reason: ShelfLabelReason }) {
  const labels = {
    PRICE_CHANGE: "Price changed",
    NEW_STOCK: "New stock",
    PROMOTION: "Promotion",
  };
  const colors = {
    PRICE_CHANGE: "bg-blue-500/10 text-blue-700",
    NEW_STOCK: "bg-emerald-500/10 text-emerald-700",
    PROMOTION: "bg-red-500/10 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[reason]}`}>
      {labels[reason]}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex min-h-44 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading…
    </div>
  );
}

function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="size-7 text-[var(--brand-red)]" />
      <div>
        <div className="font-extrabold">Could not load data</div>
        <div className="text-sm font-semibold text-muted-foreground">{message}</div>
      </div>
      <button onClick={onRetry} className="rounded-lg border-2 px-4 py-2 text-sm font-bold">
        Try again
      </button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  compact = false,
}: {
  icon: typeof Printer;
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? "min-h-44" : "min-h-80 rounded-2xl border-2 bg-card"
      }`}
    >
      <Icon className="mb-3 size-9 text-muted-foreground" />
      <h2 className="font-extrabold">{title}</h2>
      <p className="mt-1 max-w-md text-sm font-semibold text-muted-foreground">{text}</p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-md">
        <Printer className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-extrabold">Access denied</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          SEL Printing requires the shelf-label read or print permission.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-5 text-sm font-extrabold text-white"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
