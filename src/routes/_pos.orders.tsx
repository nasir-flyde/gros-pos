import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  Banknote,
  CalendarDays,
  ChevronRight,
  Loader2,
  ReceiptText,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type OrderItem, type PosOrder } from "@/lib/order-api";
import { type PosJoinedVariant } from "@/lib/product-api";
import { useLiveCatalog } from "@/lib/use-live-catalog";
import { getErrorMessage } from "@/lib/pos-page-state";
import {
  returnApi,
  type RefundMethod,
  type ReturnDisposition,
  type ReturnRecord,
  type ReturnResolution,
} from "@/lib/return-api";

export const Route = createFileRoute("/_pos/orders")({
  head: () => ({ meta: [{ title: "Orders" }] }),
  component: OrdersPage,
});

const inr = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const formatOrderDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
const formatOrderTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const itemName = (item: OrderItem) =>
  (typeof item.productVariantId === "object" ? item.productVariantId.variantName : undefined) ||
  item.variantName ||
  item.sku ||
  "Variant";
const orderUnitCount = (order: PosOrder) =>
  (order.items ?? []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
const paymentClassName = (paymentMode: string) => {
  const normalized = paymentMode.toUpperCase();
  if (normalized.includes("CASH")) return "bg-[var(--brand-green)]/15 text-[var(--brand-green)]";
  if (normalized.includes("UPI") || normalized.includes("PAYTM")) {
    return "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]";
  }
  if (normalized.includes("CARD")) return "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]";
  return "bg-[var(--secondary)] text-muted-foreground";
};
function OrdersPage() {
  const queryClient = useQueryClient();
  const { scopes, permissions, user } = useAuthStore();
  const canReadOrders = Boolean(user?.isSuperAdmin || permissions.includes("order.read"));
  const canReadReturns = Boolean(user?.isSuperAdmin || permissions.includes("return.read"));
  const canWriteReturns = Boolean(user?.isSuperAdmin || permissions.includes("return.write"));
  const pendingRef = useRef(false);
  const requestKeys = useRef(new Map<string, string>());
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [resolution, setResolution] = useState<ReturnResolution>("REFUND");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [disposition, setDisposition] = useState<ReturnDisposition>("SELLABLE");
  const [reason, setReason] = useState("");
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacement, setReplacement] = useState<PosJoinedVariant | null>(null);
  const [submittedReturn, setSubmittedReturn] = useState<ReturnRecord | null>(null);

  const searchParams = useMemo(
    () => ({
      limit: 20,
      status: "COMPLETED",
      storeId,
      ...(dateFrom ? { dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString() } : {}),
      ...(dateTo ? { dateTo: new Date(`${dateTo}T23:59:59`).toISOString() } : {}),
      ...(query.trim() ? { search: query.trim() } : {}),
    }),
    [dateFrom, dateTo, query, storeId],
  );
  const orderListQuery = useQuery({
    queryKey: ["orders-list", searchParams],
    queryFn: () => orderApi.list(searchParams),
    enabled: Boolean(storeId) && canReadOrders,
  });
  const selectedOrderQuery = useQuery({
    queryKey: ["return-order-detail", selectedOrderId],
    queryFn: () => orderApi.getById(selectedOrderId!),
    enabled: Boolean(selectedOrderId) && canReadOrders,
  });
  const orderReturnsQuery = useQuery({
    queryKey: ["return-requests", selectedOrderId],
    queryFn: () => returnApi.list({ orderId: selectedOrderId, limit: 50 }),
    enabled: Boolean(selectedOrderId) && canReadReturns,
  });
  const catalogQuery = useLiveCatalog("return-replacement-catalog", storeId);

  const order = selectedOrderQuery.data?.data ?? null;
  const pendingReturn = (orderReturnsQuery.data?.data ?? []).find((record) =>
    ["REQUESTED", "VERIFIED", "FULFILLING"].includes(record.status),
  );
  const items = order?.items ?? [];
  const selectedItems = items.filter((item) => Number(quantities[item._id] || 0) > 0);
  const returnedValue = selectedItems.reduce(
    (sum, item) =>
      sum + (Number(item.lineTotal || 0) / Number(item.quantity || 1)) * quantities[item._id],
    0,
  );
  const selectedQuantity = selectedItems.reduce((sum, item) => sum + quantities[item._id], 0);
  const replacementValue =
    resolution === "DIFFERENT_ITEM_EXCHANGE"
      ? Number(replacement?.price || 0) * selectedQuantity
      : resolution === "SAME_ITEM_EXCHANGE"
        ? returnedValue
        : 0;
  const priceDifference = replacementValue - returnedValue;
  const needsRefundMethod =
    resolution === "REFUND" || resolution === "STORE_CREDIT" || priceDifference < 0;
  const canSubmit = Boolean(
    canReadOrders &&
    canReadReturns &&
    canWriteReturns &&
    order &&
    orderReturnsQuery.isSuccess &&
    !pendingReturn &&
    !submittedReturn &&
    selectedItems.length &&
    reason.trim() &&
    (resolution !== "DIFFERENT_ITEM_EXCHANGE" || replacement) &&
    (!needsRefundMethod || refundMethod) &&
    !(refundMethod === "STORE_CREDIT" && !order.customerId),
  );
  const matchingReplacements = (catalogQuery.data?.variants ?? [])
    .filter((variant) => {
      const needle = replacementSearch.trim().toLowerCase();
      return (
        !needle ||
        variant.variantName.toLowerCase().includes(needle) ||
        variant.sku.toLowerCase().includes(needle) ||
        variant.barcodes.some((barcode) => barcode.toLowerCase().includes(needle))
      );
    })
    .slice(0, 30);
  const visibleOrders = useMemo(() => {
    const orders = orderListQuery.data?.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((candidate) => {
      const haystack = [
        candidate.orderNumber,
        candidate.customerId?.name,
        candidate.customerId?.mobile,
        candidate.paymentMode,
        ...(candidate.items ?? []).flatMap((item) => [
          itemName(item),
          item.sku,
          typeof item.productVariantId === "object" ? item.productVariantId.sku : "",
          typeof item.productVariantId === "object" ? item.productVariantId.variantName : "",
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [orderListQuery.data, query]);

  const workflowMutation = useMutation({
    mutationFn: async () => {
      if (!order || !canSubmit) throw new Error("Return access or valid selection required");
      if (pendingRef.current) throw new Error("Return submission already in progress");
      const payload: Parameters<typeof returnApi.create>[0] = {
        orderId: order._id,
        channel: "IN_STORE",
        issueType: resolution === "SAME_ITEM_EXCHANGE" ? "SAME_ITEM_EXCHANGE" : "CUSTOMER_RETURN",
        resolutionType: resolution,
        refundMethod: needsRefundMethod
          ? resolution === "STORE_CREDIT"
            ? "STORE_CREDIT"
            : refundMethod
          : undefined,
        receiptVerified: true,
        reason: reason.trim(),
        items: selectedItems.map((item) => ({
          orderItemId: item._id,
          quantity: quantities[item._id],
          disposition,
          ...(resolution === "DIFFERENT_ITEM_EXCHANGE" && replacement
            ? {
                replacementProductVariantId: replacement._id,
                replacementQuantity: quantities[item._id],
              }
            : {}),
        })),
      };
      const signature = JSON.stringify(payload);
      let key = requestKeys.current.get(signature);
      if (!key) {
        key = crypto.randomUUID();
        requestKeys.current.set(signature, key);
      }
      pendingRef.current = true;
      try {
        const created = await returnApi.create(payload, key);
        return created.data;
      } finally {
        pendingRef.current = false;
      }
    },
    onSuccess: (record) => {
      setSubmittedReturn(record);
      toast.success(`${record.returnNumber} sent for approval`);
      void queryClient.invalidateQueries({ queryKey: ["orders-list"] });
      void queryClient.invalidateQueries({ queryKey: ["return-requests", selectedOrderId] });
      void queryClient.invalidateQueries({ queryKey: ["return-order-detail", selectedOrderId] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Return request could not be submitted")),
  });

  const selectOrder = (nextOrder: PosOrder) => {
    setSelectedOrderId(nextOrder._id);
    setQuantities({});
    setSubmittedReturn(null);
    setReplacement(null);
    setReplacementSearch("");
    setReason("");
  };

  const closeOrder = () => {
    setSelectedOrderId(null);
    setQuantities({});
    setSubmittedReturn(null);
    setReplacement(null);
    setReplacementSearch("");
    setReason("");
  };

  if (!canReadOrders)
    return (
      <div role="alert" className="p-5">
        Order read permission required.
      </div>
    );

  return (
    <div className="h-full overflow-y-auto p-5">
      {(!canReadReturns || !canWriteReturns) && (
        <p role="status">Return read and write permissions are required to submit a return.</p>
      )}
      {!selectedOrderId ? (
        <>
          <h1 className="text-2xl font-extrabold">Orders</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Find recent completed orders, then open an order to process a return, refund, or
            exchange.
          </p>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(320px,1fr)_auto]">
            <div className="flex items-center gap-2 rounded-lg border-2 border-[var(--brand-blue)]/30 bg-card px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer, order number, SKU, or product"
                className="w-full bg-transparent text-lg font-bold focus:outline-none"
              />
            </div>
            <div className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[auto_auto_auto]">
              <label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase text-muted-foreground">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-md border bg-white px-2 py-2 text-sm font-bold"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-md border bg-white px-2 py-2 text-sm font-bold"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="rounded-md border px-3 py-2 text-sm font-extrabold hover:bg-[var(--secondary)]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 border-2 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[var(--secondary)] px-4 py-3">
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  {query.trim() || dateFrom || dateTo
                    ? "Matching completed orders"
                    : "Recent completed orders"}
                </div>
                <div className="text-lg font-extrabold tabular-nums">
                  {visibleOrders.length} {visibleOrders.length === 1 ? "order" : "orders"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase text-muted-foreground">Total value</div>
                <div className="text-lg font-extrabold tabular-nums">
                  {inr(visibleOrders.reduce((sum, candidate) => sum + candidate.grandTotal, 0))}
                </div>
              </div>
            </div>
            {orderListQuery.isLoading ? (
              <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />
            ) : orderListQuery.isError ? (
              <div className="p-3 text-sm font-semibold text-[var(--brand-red)]">
                {getErrorMessage(orderListQuery.error, "Completed orders could not be loaded")}
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
                No completed orders match these filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1020px]">
                  <div className="grid grid-cols-[260px_minmax(210px,1.3fr)_150px_110px_120px_150px_54px] items-center gap-3 border-b px-4 py-2 text-[11px] font-bold uppercase text-muted-foreground">
                    <span>Order</span>
                    <span>Customer</span>
                    <span>Date</span>
                    <span>Items</span>
                    <span>Payment</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {visibleOrders.map((candidate) => {
                      const unitCount = orderUnitCount(candidate);
                      return (
                        <button
                          key={candidate._id}
                          type="button"
                          onClick={() => selectOrder(candidate)}
                          className="grid min-h-[76px] w-full grid-cols-[260px_minmax(210px,1.3fr)_150px_110px_120px_150px_54px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--secondary)] focus:bg-[var(--secondary)] focus:outline-none"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <ReceiptText className="h-4 w-4 shrink-0 text-[var(--brand-blue)]" />
                              <b className="break-all text-base">{candidate.orderNumber}</b>
                            </span>
                            <small className="mt-1 block font-bold uppercase text-muted-foreground">
                              {candidate.status}
                            </small>
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]">
                                <UserRound className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <b className="block truncate">
                                  {candidate.customerId?.name || "Walk-in customer"}
                                </b>
                                <small className="block truncate text-muted-foreground">
                                  {candidate.customerId?.mobile || "No mobile linked"}
                                </small>
                              </span>
                            </span>
                          </span>
                          <span>
                            <b className="block">{formatOrderDate(candidate.createdAt)}</b>
                            <small className="block text-muted-foreground">
                              {formatOrderTime(candidate.createdAt)}
                            </small>
                          </span>
                          <span>
                            <b className="block tabular-nums">
                              {unitCount || candidate.items?.length || 0}
                            </b>
                            <small className="block text-muted-foreground">units</small>
                          </span>
                          <span
                            className={`inline-flex w-fit rounded px-2.5 py-1 text-xs font-extrabold ${paymentClassName(candidate.paymentMode || "")}`}
                          >
                            {candidate.paymentMode || "—"}
                          </span>
                          <span className="text-right">
                            <b className="block text-lg tabular-nums">
                              {inr(candidate.grandTotal)}
                            </b>
                            <small className="font-bold text-[var(--brand-blue)]">
                              Return / refund
                            </small>
                          </span>
                          <span className="flex justify-end">
                            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--brand-blue)] text-white">
                              <ChevronRight className="h-5 w-5" />
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={closeOrder}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 bg-card hover:bg-[var(--secondary)]"
              aria-label="Back to orders"
              title="Back to orders"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold">Return / Refund / Exchange</h1>
              <p className="truncate text-sm font-semibold text-muted-foreground">
                {order
                  ? `${order.orderNumber} · ${order.customerId?.name || "Walk-in customer"}`
                  : "Loading selected order"}
              </p>
            </div>
          </div>
          {order ? <b className="text-xl tabular-nums">{inr(order.grandTotal)}</b> : null}
        </div>
      )}

      {selectedOrderId && selectedOrderQuery.isLoading ? (
        <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin" />
      ) : selectedOrderId && order ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="border-2 bg-card p-4">
            <div className="border-b pb-3">
              <b>Order {order.orderNumber}</b>
              <div className="text-sm font-semibold text-muted-foreground">
                {order.customerId?.name || "Walk-in customer"} · {order.paymentMode} ·{" "}
                {new Date(order.createdAt).toLocaleString("en-IN")}
              </div>
            </div>
            <div className="divide-y">
              {items.map((item) => {
                const quantity = quantities[item._id] || 0;
                return (
                  <div
                    key={item._id}
                    className="grid grid-cols-[28px_1fr_110px] items-center gap-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={quantity > 0}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item._id]: event.target.checked ? Math.min(1, item.quantity) : 0,
                        }))
                      }
                      className="h-5 w-5"
                    />
                    <div>
                      <b>{itemName(item)}</b>
                      {item.markdownCode ? (
                        <div className="text-[10px] font-extrabold text-[var(--brand-orange)]">
                          MARKDOWN · Batch {item.batchNumber || "—"} · Saved{" "}
                          {inr(item.markdownDiscount || item.discountAmount || 0)}
                        </div>
                      ) : null}
                      <div className="text-xs font-semibold text-muted-foreground">
                        {item.sku ||
                          (typeof item.productVariantId === "object"
                            ? item.productVariantId.sku
                            : "")}{" "}
                        · Bought {item.quantity} · {inr(item.lineTotal)}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      step={item.sellingMode === "WEIGHT" ? 0.001 : 1}
                      value={quantity}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [item._id]: Math.min(
                            item.quantity,
                            Math.max(0, Number(event.target.value)),
                          ),
                        }))
                      }
                      aria-label={`Return quantity for ${itemName(item)}`}
                      className="w-full rounded-md border px-3 py-2 text-right font-bold"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            {pendingReturn ? (
              <section className="border-2 border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 p-4">
                <div className="text-xs font-bold uppercase text-muted-foreground">
                  Existing request
                </div>
                <div className="mt-1 font-extrabold">{pendingReturn.returnNumber}</div>
                <div className="mt-1 text-sm font-bold">
                  {pendingReturn.status === "REQUESTED"
                    ? "Pending approval"
                    : pendingReturn.status.replaceAll("_", " ")}
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  This invoice already has an active return request. It must be approved or rejected
                  before another request can be submitted.
                </p>
              </section>
            ) : null}
            <section className="border-2 bg-card p-4">
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Resolution
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["REFUND", "Refund", Banknote],
                    ["SAME_ITEM_EXCHANGE", "Same item", ArrowRightLeft],
                    ["DIFFERENT_ITEM_EXCHANGE", "Different item", ArrowRightLeft],
                    ["STORE_CREDIT", "Store credit", Wallet],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setResolution(value);
                      if (value === "STORE_CREDIT") setRefundMethod("STORE_CREDIT");
                    }}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-md border-2 px-2 text-sm font-extrabold ${resolution === value ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/10" : "border-border"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">
                Item condition
              </label>
              <select
                value={disposition}
                onChange={(event) => setDisposition(event.target.value as ReturnDisposition)}
                className="mt-2 w-full rounded-md border bg-white px-3 py-3 font-bold"
              >
                <option value="SELLABLE">Sellable</option>
                <option value="DAMAGED">Damaged</option>
                <option value="EXPIRED">Expired</option>
                <option value="QUARANTINE">Quarantine</option>
              </select>

              <label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-none rounded-md border p-3 font-semibold"
                placeholder="Reason for return or exchange"
              />
            </section>

            {resolution === "DIFFERENT_ITEM_EXCHANGE" ? (
              <section className="border-2 bg-card p-4">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Replacement SKU / barcode
                </label>
                <input
                  value={replacementSearch}
                  onChange={(event) => setReplacementSearch(event.target.value)}
                  className="mt-2 w-full rounded-md border px-3 py-3 font-semibold"
                  placeholder="Search replacement"
                />
                <div className="mt-2 max-h-48 overflow-y-auto border">
                  {catalogQuery.isLoading ? (
                    <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin" />
                  ) : (
                    matchingReplacements.map((variant) => (
                      <button
                        key={variant._id}
                        type="button"
                        onClick={() => setReplacement(variant)}
                        className={`block w-full border-b px-3 py-2 text-left last:border-0 ${replacement?._id === variant._id ? "bg-[var(--brand-blue)]/10" : ""}`}
                      >
                        <b className="text-sm">{variant.variantName}</b>
                        <small className="block text-muted-foreground">
                          {variant.sku} · {variant.barcode || "No barcode"} · {inr(variant.price)}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {needsRefundMethod ? (
              <section className="border-2 bg-card p-4">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Refund mode
                </label>
                <select
                  value={resolution === "STORE_CREDIT" ? "STORE_CREDIT" : refundMethod}
                  disabled={resolution === "STORE_CREDIT"}
                  onChange={(event) => setRefundMethod(event.target.value as RefundMethod)}
                  className="mt-2 w-full rounded-md border bg-white px-3 py-3 font-bold"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="WALLET">Wallet</option>
                  <option value="STORE_CREDIT">Store credit</option>
                </select>
                {refundMethod === "STORE_CREDIT" && !order.customerId ? (
                  <p className="mt-2 text-xs font-bold text-[var(--brand-red)]">
                    Store credit requires a linked customer.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="border-2 bg-[var(--secondary)] p-4 font-semibold">
              <div className="flex justify-between">
                <span>Returned value</span>
                <b>{inr(returnedValue)}</b>
              </div>
              {resolution.includes("EXCHANGE") ? (
                <div className="mt-2 flex justify-between">
                  <span>Replacement value</span>
                  <b>{inr(replacementValue)}</b>
                </div>
              ) : null}
              <div className="mt-3 border-t pt-3 text-lg font-extrabold">
                {priceDifference > 0
                  ? `Due after approval ${inr(priceDifference)}`
                  : priceDifference < 0
                    ? `Refund ${inr(Math.abs(priceDifference))}`
                    : resolution.includes("EXCHANGE")
                      ? "Even exchange"
                      : `Refund ${inr(returnedValue)}`}
              </div>
            </section>

            <button
              type="button"
              disabled={!canSubmit || workflowMutation.isPending}
              onClick={() => workflowMutation.mutate()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-green)] px-4 text-base font-extrabold text-white disabled:opacity-50"
            >
              {workflowMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-5 w-5" />
              )}{" "}
              Submit for approval
            </button>
            {submittedReturn ? (
              <section className="border-2 border-[var(--brand-green)] bg-[var(--brand-green)]/10 p-4">
                <div className="font-extrabold">{submittedReturn.returnNumber}</div>
                <div className="mt-1 text-sm font-bold">Pending approval</div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  No refund, payment, exchange, or stock movement has been posted yet.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      ) : selectedOrderId && selectedOrderQuery.isError ? (
        <div className="mt-6 text-sm font-bold text-[var(--brand-red)]">
          {getErrorMessage(selectedOrderQuery.error, "Order details could not be loaded")}
        </div>
      ) : null}
    </div>
  );
}
