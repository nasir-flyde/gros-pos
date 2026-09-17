import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  PackageOpen,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import {
  inventoryConversionApi,
  variantId,
  variantLabel,
  type ConversionInput,
  type ConversionPreview,
  type ConversionRule,
  type InventoryConversion,
} from "@/lib/inventory-conversion-api";
import { getErrorMessage } from "@/lib/pos-page-state";
import {
  calculateExpectedOutput,
  canUsePackBreakdown,
  requiresLossReason,
} from "@/lib/inventory-conversion-flow";

export const Route = createFileRoute("/_pos/pack-breakdown")({
  head: () => ({ meta: [{ title: "Pack Breakdown" }] }),
  component: PackBreakdownPage,
});

const inputClass =
  "mt-1 h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-semibold outline-none focus:border-[var(--brand-blue)] disabled:cursor-not-allowed disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:border-border disabled:bg-[var(--secondary)] disabled:text-muted-foreground disabled:opacity-60";
const money = (value?: number) =>
  value == null
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

function PackBreakdownPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const user = useAuthStore((state) => state.user);
  const scopes = useAuthStore((state) => state.scopes);
  const store = scopes.find((scope) => scope.type === "store");
  const allowed = canUsePackBreakdown(permissions, Boolean(user?.isSuperAdmin));

  if (!allowed) return <AccessDenied />;
  if (!store)
    return (
      <AccessDenied message="A store assignment is required to create pack breakdown requests." />
    );

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/inventory"
              className="grid size-11 place-items-center rounded-xl border-2 bg-card"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold">Pack Breakdown</h1>
              <p className="text-sm font-semibold text-muted-foreground">
                {store.name} · packed stock becomes sellable loose stock after approval
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-extrabold text-amber-800">
            Stock changes only after Admin approval
          </div>
        </header>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
          <BreakdownForm storeId={store.id} />
          <RecentRequests storeId={store.id} />
        </div>
      </div>
    </div>
  );
}

function BreakdownForm({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const [ruleId, setRuleId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState(1);
  const [actualOutputQuantity, setActualOutputQuantity] = useState(0);
  const [lossReason, setLossReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [draft, setDraft] = useState<InventoryConversion | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["pack-breakdown-rules", storeId],
    queryFn: () => inventoryConversionApi.listRules(storeId),
  });
  const rules = rulesQuery.data?.data || [];
  const rule = rules.find((item) => item._id === ruleId);
  const sourceVariantId = variantId(rule?.sourceVariantId);
  const batchesQuery = useQuery({
    queryKey: ["pack-breakdown-batches", storeId, sourceVariantId],
    queryFn: () => inventoryConversionApi.listBatches(storeId, sourceVariantId),
    enabled: Boolean(sourceVariantId),
  });
  const batches = (batchesQuery.data?.data || []).filter(
    (batch) => Number(batch.quantityAvailable) > 0,
  );
  const expected = rule
    ? calculateExpectedOutput(
        sourceQuantity,
        rule.sourceQuantity,
        rule.expectedOutputQuantity,
        targetMode(rule),
      )
    : 0;
  const unit = targetUnit(rule);
  const payload: ConversionInput = {
    storeId,
    ruleId,
    sourceBatchId: batchId,
    sourceQuantity: Number(sourceQuantity),
    actualOutputQuantity: Number(actualOutputQuantity),
    ...(lossReason.trim() ? { lossReason: lossReason.trim() } : {}),
    ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
  };
  const resetPreview = () => setPreview(null);
  const resetForm = () => {
    setRuleId("");
    setBatchId("");
    setSourceQuantity(1);
    setActualOutputQuantity(0);
    setLossReason("");
    setRemarks("");
    setPreview(null);
    setDraft(null);
  };
  const previewMutation = useMutation({
    mutationFn: () => inventoryConversionApi.preview(payload),
    onSuccess: (response) => {
      setPreview(response.data);
      toast.success("Stock and value impact checked");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Preview could not be calculated")),
  });
  const saveMutation = useMutation({
    mutationFn: async () =>
      draft
        ? inventoryConversionApi.updateDraft(draft._id, {
            sourceBatchId: batchId,
            sourceQuantity: Number(sourceQuantity),
            actualOutputQuantity: Number(actualOutputQuantity),
            lossReason: lossReason.trim() || null,
            remarks: remarks.trim() || null,
          })
        : inventoryConversionApi.createDraft({
            ...payload,
            idempotencyKey: createIdempotencyKey(),
          }),
    onSuccess: (response) => {
      setDraft(response.data);
      toast.success(`${response.data.conversionNumber} saved as draft`);
      void client.invalidateQueries({ queryKey: ["pack-breakdown-requests", storeId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Draft could not be saved")),
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      const saved = draft
        ? await inventoryConversionApi.updateDraft(draft._id, {
            sourceBatchId: batchId,
            sourceQuantity: Number(sourceQuantity),
            actualOutputQuantity: Number(actualOutputQuantity),
            lossReason: lossReason.trim() || null,
            remarks: remarks.trim() || null,
          })
        : await inventoryConversionApi.createDraft({
            ...payload,
            idempotencyKey: createIdempotencyKey(),
          });
      return inventoryConversionApi.submit(saved.data._id);
    },
    onSuccess: (response) => {
      toast.success(`${response.data.conversionNumber} sent for approval`);
      void client.invalidateQueries({ queryKey: ["pack-breakdown-requests", storeId] });
      void client.invalidateQueries({ queryKey: ["pack-breakdown-batches", storeId] });
      resetForm();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Request could not be submitted")),
  });

  const ready = Boolean(ruleId && batchId && sourceQuantity > 0 && actualOutputQuantity > 0);
  const hasRequiredLossReason =
    !requiresLossReason(actualOutputQuantity, expected) || Boolean(lossReason.trim());

  return (
    <section className="space-y-4 rounded-2xl border-2 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold">New breakdown request</h2>
          <p className="text-xs font-semibold text-muted-foreground">
            Choose the pack and batch physically being opened.
          </p>
        </div>
        {draft && (
          <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-extrabold text-slate-700">
            Draft {draft.conversionNumber}
          </span>
        )}
      </div>
      {rulesQuery.isLoading ? (
        <Loading text="Loading conversion rules…" />
      ) : rules.length === 0 ? (
        <Notice text="No active conversion rule exists for this store. Ask an Admin rule manager to configure one." />
      ) : (
        <>
          <label className="block text-xs font-extrabold text-muted-foreground">
            Conversion rule
            <select
              className={inputClass}
              disabled={Boolean(draft)}
              value={ruleId}
              onChange={(e) => {
                const next = rules.find((item) => item._id === e.target.value);
                setRuleId(e.target.value);
                setBatchId("");
                setSourceQuantity(next?.sourceQuantity || 1);
                setActualOutputQuantity(next?.expectedOutputQuantity || 0);
                setLossReason("");
                resetPreview();
              }}
            >
              <option value="">Select packed item → loose item</option>
              {rules.map((item) => (
                <option key={item._id} value={item._id}>
                  {variantLabel(item.sourceVariantId)} → {variantLabel(item.targetVariantId)} (
                  {item.sourceQuantity} → {item.expectedOutputQuantity} {targetUnit(item)})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-extrabold text-muted-foreground">
            Source batch
            <select
              className={inputClass}
              disabled={!rule || batchesQuery.isLoading}
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                resetPreview();
              }}
            >
              <option value="">
                {batchesQuery.isLoading ? "Loading batches…" : "Select available batch"}
              </option>
              {batches.map((batch) => (
                <option key={batch._id} value={batch._id} disabled={batch.purchaseRate == null}>
                  {batch.batchNumber} · {batch.quantityAvailable} packs available
                  {batch.expiryDate
                    ? ` · expires ${new Date(batch.expiryDate).toLocaleDateString("en-IN")}`
                    : ""}
                  {batch.purchaseRate == null ? " · cost missing" : ""}
                </option>
              ))}
            </select>
          </label>
          {rule && batches.length === 0 && !batchesQuery.isLoading && (
            <Notice text="No available source batch exists for this packed item." />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-extrabold text-muted-foreground">
              Packs to open
              <input
                className={inputClass}
                type="number"
                min={rule?.sourceQuantity || 1}
                step={rule?.sourceQuantity || 1}
                value={sourceQuantity}
                onChange={(e) => {
                  const next = Math.max(rule?.sourceQuantity || 1, Number(e.target.value));
                  setSourceQuantity(next);
                  const nextExpected = rule
                    ? calculateExpectedOutput(
                        next,
                        rule.sourceQuantity,
                        rule.expectedOutputQuantity,
                        targetMode(rule),
                      )
                    : 0;
                  setActualOutputQuantity(nextExpected);
                  setLossReason("");
                  resetPreview();
                }}
              />
            </label>
            <div className="rounded-xl bg-[var(--secondary)] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                Expected output
              </p>
              <p className="mt-1 text-2xl font-extrabold">
                {expected} <span className="text-sm">{unit}</span>
              </p>
            </div>
          </div>
          <label className="block text-xs font-extrabold text-muted-foreground">
            Actual sellable output
            <input
              className={inputClass}
              type="number"
              min={rule && targetMode(rule) === "FIXED" ? "1" : "0.001"}
              max={expected || undefined}
              step={rule && targetMode(rule) === "FIXED" ? "1" : "0.001"}
              value={actualOutputQuantity || ""}
              onChange={(e) => {
                setActualOutputQuantity(Number(e.target.value));
                resetPreview();
              }}
            />
          </label>
          {actualOutputQuantity > 0 && actualOutputQuantity < expected && (
            <label className="block text-xs font-extrabold text-red-700">
              Loss reason (required)
              <textarea
                className={`${inputClass} min-h-20 py-3`}
                maxLength={500}
                placeholder="Damaged, missing, short weight…"
                value={lossReason}
                onChange={(e) => {
                  setLossReason(e.target.value);
                  resetPreview();
                }}
              />
            </label>
          )}
          <label className="block text-xs font-extrabold text-muted-foreground">
            Remarks (optional)
            <textarea
              className={`${inputClass} min-h-20 py-3`}
              maxLength={1000}
              placeholder="Physical breakdown notes"
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                resetPreview();
              }}
            />
          </label>
          {preview && <PreviewCard preview={preview} unit={unit} />}
          {!preview && ready && hasRequiredLossReason && (
            <p className="rounded-xl bg-amber-500/10 p-3 text-xs font-extrabold text-amber-800">
              Preview the breakdown first. Submit becomes available after the stock and cost check
              passes.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              className={`${buttonClass} border-2`}
              disabled={!ready || !hasRequiredLossReason || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}{" "}
              Preview
            </button>
            <button
              type="button"
              className={`${buttonClass} bg-[var(--secondary)]`}
              disabled={!preview || saveMutation.isPending || submitMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}{" "}
              Save draft
            </button>
            <button
              type="button"
              className={`${buttonClass} bg-[var(--brand-blue)] text-white`}
              disabled={!preview || submitMutation.isPending || saveMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}{" "}
              Submit
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PreviewCard({ preview, unit }: { preview: ConversionPreview; unit: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <div className="flex items-center gap-2 font-extrabold">
        <CheckCircle2 className="size-5" /> Preview validated
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PreviewMetric label="Input value" value={money(preview.sourceInventoryValue)} />
        <PreviewMetric label="Sellable output" value={`${preview.actualOutputQuantity} ${unit}`} />
        <PreviewMetric label="Unit cost" value={money(preview.targetUnitCost)} />
        <PreviewMetric
          label="Loss"
          value={`${preview.lossQuantity} ${unit} · ${money(preview.lossInventoryValue)}`}
        />
      </div>
      <p className="mt-3 text-xs font-semibold">
        Saving or submitting still does not change stock. Admin approval performs the stock
        movement.
      </p>
    </div>
  );
}

function RecentRequests({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<InventoryConversion | null>(null);
  const query = useQuery({
    queryKey: ["pack-breakdown-requests", storeId],
    queryFn: () => inventoryConversionApi.list(storeId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const records = query.data?.data || [];
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryConversionApi.cancel(id, reason),
    onSuccess: (response) => {
      toast.success(`${response.data.conversionNumber} cancelled`);
      setSelected(response.data);
      void client.invalidateQueries({ queryKey: ["pack-breakdown-requests", storeId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Draft could not be cancelled")),
  });
  const cancel = (record: InventoryConversion) => {
    const reason = window.prompt("Why are you cancelling this draft?");
    if (reason?.trim()) cancelMutation.mutate({ id: record._id, reason: reason.trim() });
  };
  return (
    <section className="overflow-hidden rounded-2xl border-2 bg-card">
      <div className="flex items-center justify-between border-b-2 p-4">
        <div>
          <h2 className="text-lg font-extrabold">Recent store requests</h2>
          <p className="text-xs font-semibold text-muted-foreground">
            Auto-refreshes while the terminal is open.
          </p>
        </div>
        <button
          className="grid size-10 place-items-center rounded-xl border-2"
          onClick={() => void query.refetch()}
        >
          <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="max-h-[650px] divide-y overflow-y-auto">
        {query.isLoading && <Loading text="Loading requests…" />}
        {!query.isLoading && records.length === 0 && (
          <Notice text="No pack breakdown requests have been created for this store." />
        )}
        {records.map((record) => (
          <article key={record._id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold">{record.conversionNumber}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {dateTime(record.submittedAt || record.createdAt)}
                </p>
              </div>
              <ConversionStatus status={record.status} />
            </div>
            <p className="mt-2 text-sm font-bold">
              {variantLabel(record.sourceVariantId)} → {variantLabel(record.targetVariantId)}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <span>
                <b>{record.sourceQuantity}</b>
                <br />
                packs
              </span>
              <span>
                <b>{record.actualOutputQuantity}</b>
                <br />
                {record.targetUnitType}
              </span>
              <span className={record.lossQuantity > 0 ? "text-red-700" : ""}>
                <b>{record.lossQuantity}</b>
                <br />
                loss
              </span>
            </div>
            {record.status === "SUBMITTED" && (
              <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-xs font-extrabold text-amber-800">
                Awaiting approval — inventory has not changed.
              </p>
            )}
            {record.rejectionReason && (
              <p className="mt-2 text-xs text-red-700">Rejected: {record.rejectionReason}</p>
            )}
            {record.reversalReason && (
              <p className="mt-2 text-xs text-red-700">Reversed: {record.reversalReason}</p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                className={`${buttonClass} min-h-9 border-2 px-3 text-xs`}
                onClick={() => setSelected(record)}
              >
                Details
              </button>
              {record.status === "DRAFT" && (
                <button
                  className={`${buttonClass} min-h-9 border-2 border-red-200 px-3 text-xs text-red-700`}
                  onClick={() => cancel(record)}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {selected && <RequestDetail record={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function RequestDetail({ record, onClose }: { record: InventoryConversion; onClose: () => void }) {
  const sourceBatch = typeof record.sourceBatchId === "string" ? undefined : record.sourceBatchId;
  const targetBatch = typeof record.targetBatchId === "string" ? undefined : record.targetBatchId;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground">Conversion request</p>
            <h3 className="text-xl font-extrabold">{record.conversionNumber}</h3>
          </div>
          <button className="grid size-10 place-items-center rounded-xl border-2" onClick={onClose}>
            <XCircle className="size-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <ConversionStatus status={record.status} />
          <DetailRow label="Packed source" value={variantLabel(record.sourceVariantId)} />
          <DetailRow label="Loose target" value={variantLabel(record.targetVariantId)} />
          <DetailRow label="Source batch" value={sourceBatch?.batchNumber || "—"} />
          <DetailRow
            label="Generated batch"
            value={targetBatch?.batchNumber || "Created after approval"}
          />
          <DetailRow
            label="Expected / actual"
            value={`${record.expectedOutputQuantity} / ${record.actualOutputQuantity} ${record.targetUnitType}`}
          />
          <DetailRow label="Source inventory value" value={money(record.sourceInventoryValue)} />
          <DetailRow label="Sellable inventory value" value={money(record.targetInventoryValue)} />
          <DetailRow
            label="Loss"
            value={`${record.lossQuantity} ${record.targetUnitType} · ${money(record.lossInventoryValue)}`}
          />
          {record.lossReason && <DetailRow label="Loss reason" value={record.lossReason} />}
          {record.remarks && <DetailRow label="Remarks" value={record.remarks} />}
          {record.status === "SUBMITTED" && (
            <p className="rounded-xl bg-amber-500/10 p-3 text-xs font-extrabold text-amber-800">
              Awaiting approval. No source or target stock has changed yet.
            </p>
          )}
          {record.status === "POSTED" && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-xs font-extrabold text-emerald-800">
              Posted. Packed stock was consumed and loose stock was credited together.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function targetMode(rule?: ConversionRule) {
  const target =
    rule && typeof rule.targetVariantId !== "string" ? rule.targetVariantId : undefined;
  return target?.sellingMode || "FIXED";
}
function targetUnit(rule?: ConversionRule) {
  const target =
    rule && typeof rule.targetVariantId !== "string" ? rule.targetVariantId : undefined;
  return target?.unitType || "EA";
}
function createIdempotencyKey() {
  return `pos-conversion-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}
function ConversionStatus({ status }: { status: InventoryConversion["status"] }) {
  const colors =
    status === "POSTED"
      ? "bg-emerald-500/10 text-emerald-800"
      : ["REJECTED", "CANCELLED", "REVERSED"].includes(status)
        ? "bg-red-500/10 text-red-800"
        : status === "SUBMITTED"
          ? "bg-amber-500/10 text-amber-800"
          : "bg-slate-500/10 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${colors}`}>
      {status === "SUBMITTED" ? "AWAITING APPROVAL" : status}
    </span>
  );
}
function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b py-2">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-extrabold">{value}</span>
    </div>
  );
}
function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm font-bold text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> {text}
    </div>
  );
}
function Notice({ text }: { text: string }) {
  return (
    <div className="m-4 rounded-xl bg-[var(--secondary)] p-4 text-center text-sm font-bold text-muted-foreground">
      {text}
    </div>
  );
}
function AccessDenied({
  message = "Pack Breakdown requires conversion read/write and store inventory read permissions.",
}: {
  message?: string;
}) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-md">
        <PackageOpen className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-extrabold">Access denied</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">{message}</p>
        <Link to="/inventory" className={`${buttonClass} mt-5 bg-[var(--brand-blue)] text-white`}>
          <ArrowLeft className="size-4" /> Back to inventory
        </Link>
      </div>
    </div>
  );
}
