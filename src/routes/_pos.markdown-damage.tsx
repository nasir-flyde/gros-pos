import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgePercent,
  Camera,
  Eye,
  Loader2,
  PackageX,
  Printer,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { uploadMarkdownProof } from "@/lib/direct-upload";
import {
  markdownApi,
  type MarkdownDamageType,
  type MarkdownRequestRecord,
  type MarkdownRequestScan,
  type MarkdownRequestType,
} from "@/lib/markdown-api";
import { useAuthStore } from "@/lib/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_pos/markdown-damage")({
  head: () => ({ meta: [{ title: "Markdown & Damage — CHHOTA BAZAAR POS" }] }),
  component: MarkdownDamagePage,
});

const fieldClass =
  "h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-semibold outline-none focus:border-[var(--brand-blue)]";
const damageTypes: Array<[MarkdownDamageType, string]> = [
  ["PACKAGING_DAMAGE", "Packaging damage — saleable"],
  ["COSMETIC_DAMAGE", "Cosmetic damage — saleable"],
  ["LEAKAGE", "Leakage — dump only"],
  ["BREAKAGE", "Breakage — dump only"],
  ["CONTAMINATION", "Contamination — dump only"],
  ["OTHER", "Other — dump only"],
];

const errorText = (error: unknown) =>
  (error as { message?: string })?.message || "The request could not be completed.";
const toDateInput = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");

function MarkdownDamagePage() {
  const permissions = useAuthStore((state) => state.permissions);
  const isSuperAdmin = useAuthStore((state) => Boolean(state.user?.isSuperAdmin));
  const store = useAuthStore((state) => state.scopes.find((scope) => scope.type === "store"));
  const canCreate = isSuperAdmin || permissions.includes("inventory.markdownRequest.create");
  const canRead = isSuperAdmin || permissions.includes("inventory.markdownRequest.read");
  const [type, setType] = useState<MarkdownRequestType>("NEAR_EXPIRY");
  const [ean, setEan] = useState("");
  const [product, setProduct] = useState<MarkdownRequestScan | null>(null);
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [damageType, setDamageType] = useState<MarkdownDamageType>("PACKAGING_DAMAGE");
  const [proof, setProof] = useState<File | null>(null);
  const [viewingRequest, setViewingRequest] = useState<MarkdownRequestRecord | null>(null);
  const queryClient = useQueryClient();

  const selectedBatch = useMemo(
    () => product?.batches.find((batch) => batch.batchId === batchId),
    [batchId, product],
  );
  const history = useQuery({
    queryKey: ["markdown-requests", store?.id],
    queryFn: async () => (await markdownApi.requests(store!.id)).data,
    enabled: Boolean(store?.id && canRead),
  });
  const lookup = useMutation({
    mutationFn: async () => (await markdownApi.scanRequestProduct(store!.id, ean.trim())).data,
    onSuccess: (data) => {
      setProduct(data);
      const first = data.batches[0];
      setBatchId(first?.batchId || "");
      setExpiryDate(toDateInput(first?.expiryDate));
      setPrice(String(Math.max(0, Math.round(data.normalSellingPrice * 0.7 * 100) / 100)));
      if (!first) toast.error("This product has no eligible stock batch.");
    },
    onError: (error) => {
      setProduct(null);
      toast.error(errorText(error));
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      if (!store?.id || !product || !selectedBatch || !proof)
        throw new Error("Complete all mandatory fields.");
      const qty = Number(quantity);
      const proposedPrice = Number(price);
      if (!Number.isInteger(qty) || qty < 1 || qty > selectedBatch.quantityAvailable) {
        throw new Error(`Quantity must be between 1 and ${selectedBatch.quantityAvailable}.`);
      }
      if (
        !Number.isFinite(proposedPrice) ||
        proposedPrice < 0 ||
        proposedPrice > product.normalSellingPrice
      ) {
        throw new Error(`Price must be between ₹0 and ₹${product.normalSellingPrice}.`);
      }
      if (type === "NEAR_EXPIRY" && !expiryDate) throw new Error("Expiry date is required.");
      const uploaded = await uploadMarkdownProof(proof);
      const created = await markdownApi.createRequest({
        requestType: type,
        storeId: store.id,
        productVariantId: product.productVariantId,
        batchId: selectedBatch.batchId,
        baseEan: product.baseEan,
        requestedQuantity: qty,
        proposedMarkdownPrice: proposedPrice,
        expiryDate:
          type === "NEAR_EXPIRY"
            ? new Date(`${expiryDate}T00:00:00.000Z`).toISOString()
            : undefined,
        damageType: type === "DAMAGED_DUMP" ? damageType : undefined,
        proofAssetId: uploaded.assetId,
      });
      return (await markdownApi.submitRequest(created.data._id)).data;
    },
    onSuccess: (record) => {
      toast.success(`${record.requestNumber} submitted to Cluster Manager.`);
      setProduct(null);
      setEan("");
      setProof(null);
      void queryClient.invalidateQueries({ queryKey: ["markdown-requests", store?.id] });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  if (!canCreate && !canRead) {
    return (
      <div className="grid h-full place-items-center p-8 text-center font-bold">
        You do not have access to Markdown & Damage requests.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--secondary)] p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-orange)]">
            Store stock control
          </p>
          <h1 className="text-2xl font-extrabold">Markdown & Damage Portal</h1>
          <p className="text-sm text-muted-foreground">
            Submit batch stock for Cluster Manager approval. Normal SKU prices never change.
          </p>
        </header>

        {canCreate && (
          <section className="rounded-2xl border bg-background p-4 shadow-sm">
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-[var(--secondary)] p-1">
              <button
                onClick={() => setType("NEAR_EXPIRY")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold ${type === "NEAR_EXPIRY" ? "bg-[var(--brand-blue)] text-white" : ""}`}
              >
                <BadgePercent className="mr-2 inline h-4 w-4" /> Near Expiry
              </button>
              <button
                onClick={() => setType("DAMAGED_DUMP")}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold ${type === "DAMAGED_DUMP" ? "bg-[var(--brand-blue)] text-white" : ""}`}
              >
                <PackageX className="mr-2 inline h-4 w-4" /> Damaged / Dump
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="text-xs font-bold">
                Base EAN
                <input
                  className={`${fieldClass} mt-1`}
                  value={ean}
                  onChange={(event) => setEan(event.target.value.replace(/\s/g, ""))}
                  placeholder="Scan or type original barcode"
                />
              </label>
              <button
                disabled={!store || ean.length < 6 || lookup.isPending}
                onClick={() => lookup.mutate()}
                className="mt-5 h-11 rounded-xl bg-[var(--brand-blue)] px-5 font-bold text-white disabled:opacity-50"
              >
                {lookup.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 inline h-4 w-4" />
                    Find item
                  </>
                )}
              </button>
            </div>

            {product && (
              <div className="mt-5 space-y-4 border-t pt-5">
                <div className="grid gap-3 rounded-xl bg-[var(--secondary)] p-4 sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Product</span>
                    <p className="font-bold">{product.productName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">SKU</span>
                    <p className="font-bold">{product.sku}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">MRP / normal</span>
                    <p className="font-bold">
                      ₹{product.mrp} / ₹{product.normalSellingPrice}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">System stock</span>
                    <p className="font-bold">{product.systemStock}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-bold">
                    Batch
                    <select
                      className={`${fieldClass} mt-1`}
                      value={batchId}
                      onChange={(event) => {
                        setBatchId(event.target.value);
                        setExpiryDate(
                          toDateInput(
                            product.batches.find((row) => row.batchId === event.target.value)
                              ?.expiryDate,
                          ),
                        );
                      }}
                    >
                      {product.batches.map((batch) => (
                        <option key={batch.batchId} value={batch.batchId}>
                          {batch.batchNumber} · {batch.quantityAvailable} units
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold">
                    Requested quantity
                    <input
                      className={`${fieldClass} mt-1`}
                      type="number"
                      min={1}
                      max={selectedBatch?.quantityAvailable}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Proposed markdown price
                    <input
                      className={`${fieldClass} mt-1`}
                      type="number"
                      min={0}
                      max={product.normalSellingPrice}
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                  </label>
                  {type === "NEAR_EXPIRY" ? (
                    <label className="text-xs font-bold">
                      Expiry date
                      <input
                        className={`${fieldClass} mt-1 cursor-pointer`}
                        type="date"
                        value={expiryDate}
                        onChange={(event) => setExpiryDate(event.target.value)}
                        required
                      />
                    </label>
                  ) : (
                    <label className="text-xs font-bold">
                      Damage type
                      <select
                        className={`${fieldClass} mt-1`}
                        value={damageType}
                        onChange={(event) =>
                          setDamageType(event.target.value as MarkdownDamageType)
                        }
                      >
                        {damageTypes.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {type === "DAMAGED_DUMP" && Number(price) === 0 && (
                  <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-5 w-5 shrink-0" /> Total dump: approval immediately
                    writes off this stock. No sale barcode is generated.
                  </div>
                )}
                <label className="block rounded-xl border-2 border-dashed p-4 text-sm font-bold">
                  <Camera className="mr-2 inline h-5 w-5" /> Mandatory proof photo
                  <input
                    className="mt-2 block w-full text-sm font-normal"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) => setProof(event.target.files?.[0] || null)}
                  />
                  {proof && (
                    <span className="mt-2 block text-xs text-green-700">
                      Selected: {proof.name}
                    </span>
                  )}
                </label>
                <button
                  disabled={!proof || !selectedBatch || submit.isPending}
                  onClick={() => submit.mutate()}
                  className="h-12 w-full rounded-xl bg-[var(--brand-green)] font-extrabold text-white disabled:opacity-50"
                >
                  {submit.isPending ? (
                    <>
                      <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
                      Uploading and submitting…
                    </>
                  ) : (
                    "Submit for Cluster Manager approval"
                  )}
                </button>
              </div>
            )}
          </section>
        )}

        {canRead && (
          <section className="rounded-2xl border bg-background p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-extrabold">My Requests</h2>
            {history.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-2">
                {(history.data || []).map((record) => {
                  const remaining = record.campaignId
                    ? record.campaignId.quantityLimit - record.campaignId.soldQuantity
                    : null;
                  return (
                    <article
                      key={record._id}
                      className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{record.requestNumber}</strong>
                          <span className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-xs font-bold">
                            {record.status}
                          </span>
                        </div>
                        <p className="text-sm">
                          {record.productName} · {record.sku} · Batch {record.batchNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty {record.requestedQuantity} · Proposed ₹{record.proposedMarkdownPrice}
                        </p>
                        {record.rejectionReason && (
                          <p className="mt-1 text-sm font-semibold text-red-700">
                            Rejected: {record.rejectionReason}
                          </p>
                        )}
                        {record.campaignId && (
                          <p className="mt-1 text-sm font-semibold text-green-700">
                            {record.campaignId.markdownCode} · {remaining} remaining
                          </p>
                        )}
                        {record.writeOffId && (
                          <p className="mt-1 text-sm font-semibold">
                            Dump posted: {record.writeOffId.writeOffNumber}
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => setViewingRequest(record)}
                          className="h-10 rounded-lg border px-3 text-sm font-bold"
                        >
                          <Eye className="mr-2 inline h-4 w-4" />
                          View
                        </button>
                        {record.campaignId && (
                          <button
                            onClick={async () => {
                              const blob = await markdownApi.requestLabel(record._id);
                              const url = URL.createObjectURL(blob);
                              window.open(url, "_blank", "noopener,noreferrer");
                              window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                            }}
                            className="h-10 rounded-lg border px-3 text-sm font-bold"
                          >
                            <Printer className="mr-2 inline h-4 w-4" />
                            Print label
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!history.data?.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No requests submitted yet.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog
        open={Boolean(viewingRequest)}
        onOpenChange={(open) => !open && setViewingRequest(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingRequest?.requestNumber || "Request details"}</DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Product:</span>
                  <br />
                  <strong>{viewingRequest.productName}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">SKU / batch:</span>
                  <br />
                  {viewingRequest.sku} · {viewingRequest.batchNumber}
                </p>
                <p>
                  <span className="text-muted-foreground">Type:</span>
                  <br />
                  {viewingRequest.requestType.replaceAll("_", " ")}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>
                  <br />
                  <strong>{viewingRequest.status}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Quantity:</span>
                  <br />
                  {viewingRequest.requestedQuantity}
                </p>
                <p>
                  <span className="text-muted-foreground">Proposed price:</span>
                  <br />₹{viewingRequest.proposedMarkdownPrice}
                </p>
                <p>
                  <span className="text-muted-foreground">Expiry:</span>
                  <br />
                  {viewingRequest.expiryDate
                    ? new Date(viewingRequest.expiryDate).toLocaleDateString("en-IN")
                    : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Damage type:</span>
                  <br />
                  {viewingRequest.damageType?.replaceAll("_", " ") || "—"}
                </p>
              </div>
              {viewingRequest.rejectionReason && (
                <p className="rounded-lg bg-red-50 p-3 font-semibold text-red-700">
                  Rejected: {viewingRequest.rejectionReason}
                </p>
              )}
              <div>
                <p className="mb-2 font-bold">Uploaded proof</p>
                <a href={viewingRequest.proofUrl} target="_blank" rel="noreferrer">
                  <img
                    src={viewingRequest.proofUrl}
                    alt={`Proof for ${viewingRequest.requestNumber}`}
                    className="max-h-96 w-full rounded-xl border bg-muted object-contain"
                  />
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
