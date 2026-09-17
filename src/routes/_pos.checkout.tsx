import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/lib/cart-context";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { findCartStockIssues, productApi } from "@/lib/product-api";
import type { CheckoutPayment } from "@/lib/order-payload";
import {
  buildSplitPaymentEntries,
  buildPaytmPosRequestPayload,
  buildPosCheckoutPayload,
  hasExactPaymentTotal,
} from "@/lib/checkout-flow";
import {
  deriveCheckoutTotals,
  getPaytmStatusTitle,
  isCheckoutSubmitDisabled,
  type CheckoutPaymentId,
} from "@/lib/checkout-ui";
import { getErrorMessage } from "@/lib/pos-page-state";
import { formatINR } from "@/lib/utils";
import { formatWeight } from "@/lib/weight";
import { getMarkdownErrorMessage, markdownApi } from "@/lib/markdown-api";
import {
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  Split,
  Home,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Percent,
  BadgeIndianRupee,
  RefreshCw,
  Pause,
} from "lucide-react";

export const Route = createFileRoute("/_pos/checkout")({
  head: () => ({ meta: [{ title: "Checkout" }] }),
  component: CheckoutPage,
});

const PAYMENTS = [
  { id: "Cash" as const, label: "Cash", icon: Banknote, color: "var(--brand-green)" },
  { id: "UPI" as const, label: "UPI", icon: Smartphone, color: "var(--brand-blue)" },
  { id: "Card" as const, label: "Card", icon: CreditCard, color: "var(--brand-orange)" },
  { id: "Wallet" as const, label: "Wallet", icon: Wallet, color: "var(--brand-red)" },
  { id: "Paytm POS" as const, label: "Paytm POS", icon: BadgeIndianRupee, color: "#00a8e8" },
  { id: "Split" as const, label: "Split", icon: Split, color: "var(--brand-blue)" },
] as const;

function CheckoutPage() {
  const queryClient = useQueryClient();
  const {
    items,
    customer,
    subtotal,
    discount,
    afterDisc,
    tax,
    clear,
    setLastCheckout,
    activeOrderId,
    updateStockLevels,
    updateMarkdownAvailability,
  } = useCart();
  const authUser = useAuthStore((s) => s.user);
  const scopes = useAuthStore((s) => s.scopes);
  const [payment, setPayment] = useState<CheckoutPaymentId>("UPI");
  const [homeDelivery, setHomeDelivery] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paytmPaymentId, setPaytmPaymentId] = useState<string | null>(null);
  const [paytmState, setPaytmState] = useState<"idle" | "waiting" | "stopped" | "failed">("idle");
  const [paytmMessage, setPaytmMessage] = useState("");
  const [paytmPollingEnabled, setPaytmPollingEnabled] = useState(false);
  const handledPaytmCompletion = useRef(false);
  const [splitPayments, setSplitPayments] = useState<
    Record<CheckoutPayment["paymentMode"], string>
  >({
    CASH: "",
    UPI: "",
    CARD: "",
    WALLET: "",
  });
  const navigate = useNavigate();

  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";
  const cashierId = authUser?.id ?? "";
  const noStore = !storeId;
  const markdownItems = items.filter((item) => Boolean(item.product.markdownCode));
  const hasMarkdown = markdownItems.length > 0;

  useEffect(() => {
    if (!hasMarkdown) return;
    if (homeDelivery) setHomeDelivery(false);
    if (discountPct) setDiscountPct(0);
  }, [discountPct, hasMarkdown, homeDelivery]);

  const {
    deliveryFee,
    extraDiscount,
    roundedGrandTotal: localRoundedGrandTotal,
  } = deriveCheckoutTotals({
    afterDisc,
    homeDelivery,
    discountPct,
  });

  const finishCheckout = useCallback(
    (result: import("@/lib/order-api").CheckoutResult, paymentLabel: CheckoutPaymentId) => {
      const checkoutOrder = result.order as PosOrder;
      const deliveryLabel: "Home" | "Walk-Out" = homeDelivery ? "Home" : "Walk-Out";
      const checkoutSummary = {
        orderId: checkoutOrder.orderNumber,
        orderObjectId: checkoutOrder._id,
        payment: paymentLabel,
        delivery: deliveryLabel,
        total: checkoutOrder.grandTotal,
        receiptData: (result.receipt as Record<string, unknown> | null) ?? undefined,
        receiptStatus: result.receiptStatus,
        receiptWarning: result.receiptWarning,
        customer: customer
          ? { _id: customer._id, name: customer.name, mobile: customer.mobile, area: customer.area }
          : null,
      };
      setLastCheckout(checkoutSummary);
      sessionStorage.setItem("pos_last_checkout", JSON.stringify(checkoutSummary));
      void queryClient.invalidateQueries({ queryKey: ["live-inventory-snapshot", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["homepage-inventory-alerts", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["live-inventory-snapshot", storeId] });
      clear();
      navigate({ to: "/success" });
    },
    [clear, customer, homeDelivery, navigate, queryClient, setLastCheckout, storeId],
  );

  const buildCommonCheckoutArgs = () => ({
    cartItems: items,
    grandTotal: localRoundedGrandTotal,
    deliveryType: (homeDelivery && !hasMarkdown ? "Home" : "Walk-Out") as "Home" | "Walk-Out",
    storeId,
    cashierId,
    charges: {
      delivery: deliveryFee,
      discount: hasMarkdown ? 0 : extraDiscount,
      discountPercent: !hasMarkdown && extraDiscount > 0 ? discountPct : undefined,
    },
    customerId: customer?._id,
    orderId: activeOrderId ?? undefined,
  });

  const quoteRequest = buildPaytmPosRequestPayload(buildCommonCheckoutArgs());
  const quoteRequestKey = JSON.stringify(quoteRequest);
  const [debouncedQuoteKey, setDebouncedQuoteKey] = useState(quoteRequestKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuoteKey(quoteRequestKey), 250);
    return () => window.clearTimeout(timer);
  }, [quoteRequestKey]);

  const quoteQuery = useQuery({
    queryKey: ["pos-checkout-quote", debouncedQuoteKey],
    queryFn: () =>
      orderApi.quoteCheckout(
        JSON.parse(debouncedQuoteKey) as Omit<
          import("@/lib/order-payload").CheckoutPayload,
          "payments"
        >,
      ),
    enabled: items.length > 0 && !noStore,
    retry: 1,
  });
  const quote = quoteQuery.data?.data;
  const quoteIsCurrent = debouncedQuoteKey === quoteRequestKey;
  const authoritativeTotal = quote?.totals.grandTotal ?? localRoundedGrandTotal;
  const quoteUnavailable = !quote || !quoteIsCurrent || quoteQuery.isPending || quoteQuery.isError;
  const promotionDiscount = (quote?.appliedOffers ?? []).reduce(
    (sum, offer) => sum + Number(offer.discountAmount || 0),
    0,
  );
  const quotedCatalogDiscount = Math.max(
    0,
    Number(quote?.totals.catalogDiscount ?? discount) - promotionDiscount,
  );
  const splitPaymentEntries: CheckoutPayment[] = buildSplitPaymentEntries(splitPayments);
  const splitPaymentTotal = splitPaymentEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const hasValidSplit = hasExactPaymentTotal(splitPaymentEntries, authoritativeTotal);
  const splitInvalid = payment === "Split" && !hasValidSplit;

  useEffect(() => {
    setSplitPayments({ CASH: "", UPI: "", CARD: "", WALLET: "" });
  }, [quote?.quoteVersion, quote?.totals.grandTotal]);

  const assertLiveStock = async () => {
    try {
      for (const item of markdownItems) {
        const code = item.product.markdownCode as string;
        const resolution = (await markdownApi.resolveLabel(storeId, code)).data;
        updateMarkdownAvailability(code, resolution.remainingQuantity);
        if (item.qty > resolution.remainingQuantity) {
          throw new Error(
            `${item.product.name}: ${resolution.remainingQuantity} markdown units remain, ${item.qty} in cart`,
          );
        }
      }
      const ordinaryItems = items.filter((item) => !item.product.markdownCode);
      if (ordinaryItems.length === 0) return;
      const variants = await productApi.getStoreVariantStock(
        ordinaryItems.map((item) => item.product._id),
        storeId,
      );
      const stockByVariantId = Object.fromEntries(
        ordinaryItems.map((item) => [item.product._id, 0]),
      );
      variants.forEach((variant) => {
        stockByVariantId[variant._id] = Number(variant.quantityAvailable || 0);
      });
      updateStockLevels(stockByVariantId);
      const issues = findCartStockIssues(ordinaryItems, variants);
      if (issues.length > 0) {
        const details = issues
          .map((issue) => `${issue.name}: ${issue.available} available, ${issue.requested} in cart`)
          .join("\n");
        throw new Error(`Stock changed before checkout.\n${details}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Stock changed before checkout.")) {
        throw error;
      }
      const value = error as { code?: string };
      throw new Error(
        value?.code?.startsWith("MARKDOWN_")
          ? getMarkdownErrorMessage(error)
          : getErrorMessage(error, "Unable to confirm live stock. Check connection and try again."),
      );
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setCheckoutError(null);
      if (noStore) throw new Error("No store assigned to your account. Contact admin.");
      if (payment === "Split" && !hasValidSplit) {
        throw new Error("Split payment amounts must add up exactly to the grand total.");
      }
      if (payment === "Paytm POS") {
        throw new Error("Use the Paytm device payment action.");
      }
      if (quoteUnavailable || !quote) {
        throw new Error("Unable to confirm current price. Refresh the quote and try again.");
      }
      await assertLiveStock();
      const payload = buildPosCheckoutPayload({
        ...buildCommonCheckoutArgs(),
        grandTotal: quote.totals.grandTotal,
        quoteVersion: quote.quoteVersion,
        payment,
        splitPayments,
      });
      return orderApi.checkout(payload);
    },
    onSuccess: (res) => {
      finishCheckout(res.data, payment);
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string;
        code?: string;
        details?: { fields?: Array<{ field: string; message: string }> };
      };
      if (e.code === "STALE_QUOTE" || e.message?.includes("must match order total")) {
        setSplitPayments({ CASH: "", UPI: "", CARD: "", WALLET: "" });
        void quoteQuery.refetch();
        setCheckoutError("Pricing changed. Review the refreshed total and confirm payment again.");
        return;
      }
      if (e?.details?.fields?.length) {
        const items = e.details.fields.map((f) => `• ${f.field}: ${f.message}`);
        setCheckoutError(items.join("\n"));
      } else {
        setCheckoutError(e?.message || "Checkout failed. Please try again.");
      }
    },
  });

  const paytmMutation = useMutation({
    mutationFn: async () => {
      setCheckoutError(null);
      if (noStore) throw new Error("No store assigned to your account. Contact admin.");
      if (quoteUnavailable || !quote) {
        throw new Error("Unable to confirm current price. Refresh the quote and try again.");
      }
      await assertLiveStock();
      return orderApi.requestPaytmPosPayment(
        buildPaytmPosRequestPayload({
          ...buildCommonCheckoutArgs(),
          grandTotal: quote.totals.grandTotal,
          quoteVersion: quote.quoteVersion,
        }),
      );
    },
    onSuccess: (res) => {
      handledPaytmCompletion.current = false;
      setPaytmPaymentId(res.data.paymentTransactionId);
      setPaytmMessage(res.data.message);
      setPaytmState("waiting");
      setPaytmPollingEnabled(false);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string; code?: string };
      if (error.code === "STALE_QUOTE" || error.message?.includes("must match order total")) {
        setSplitPayments({ CASH: "", UPI: "", CARD: "", WALLET: "" });
        void quoteQuery.refetch();
        setCheckoutError("Pricing changed. Review the refreshed total and confirm payment again.");
        return;
      }
      setCheckoutError(error.message || "Unable to send payment to the Paytm device.");
    },
  });

  useEffect(() => {
    if (!paytmPaymentId || paytmState !== "waiting" || paytmPollingEnabled) return;
    const timer = window.setTimeout(() => setPaytmPollingEnabled(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [paytmPaymentId, paytmPollingEnabled, paytmState]);

  const paytmStatusQuery = useQuery({
    queryKey: ["paytm-pos-status", paytmPaymentId],
    queryFn: () => orderApi.getPaytmPosPaymentStatus(paytmPaymentId as string),
    enabled: Boolean(paytmPaymentId && paytmPollingEnabled && paytmState === "waiting"),
    refetchInterval: 10_000,
    retry: false,
  });

  useEffect(() => {
    const result = paytmStatusQuery.data?.data;
    if (!result) return;
    setPaytmMessage(result.message);
    if (result.status === "FAILED") {
      setPaytmState("failed");
      setPaytmPollingEnabled(false);
      return;
    }
    if (result.status === "COMPLETED" && result.checkout && !handledPaytmCompletion.current) {
      handledPaytmCompletion.current = true;
      setPaytmPollingEnabled(false);
      finishCheckout(result.checkout, "Paytm POS");
    }
  }, [finishCheckout, paytmStatusQuery.data]);

  useEffect(() => {
    if (!paytmStatusQuery.error) return;
    const error = paytmStatusQuery.error as { message?: string };
    setPaytmMessage(error.message || "Unable to confirm Paytm status yet. Retrying automatically.");
  }, [paytmStatusQuery.error]);

  const resetPaytm = () => {
    setPaytmPaymentId(null);
    setPaytmState("idle");
    setPaytmMessage("");
    setPaytmPollingEnabled(false);
    handledPaytmCompletion.current = false;
  };

  const isSubmitting = checkoutMutation.isPending || paytmMutation.isPending;
  const paytmRequestActive = paytmState === "waiting" || paytmState === "stopped";
  const submitDisabled =
    noStore ||
    quoteUnavailable ||
    isCheckoutSubmitDisabled({
      isSubmitting,
      paytmRequestActive,
      payment,
      paytmState,
      hasValidSplit,
    });

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <div className="text-6xl">🛒</div>
          <div className="mt-3 text-xl font-bold">Cart is empty</div>
          <Link
            to="/new-order"
            className="mt-4 inline-flex tap-target items-center rounded-xl bg-[var(--brand-blue)] px-5 font-bold text-white"
          >
            Start New Order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Link
          to="/new-order"
          className="tap-target grid place-items-center rounded-xl bg-[var(--secondary)] px-3 font-bold active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold leading-tight">Checkout</h1>
          <p className="text-xs font-medium text-muted-foreground">Confirm payment to finalize</p>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_400px]">
        <div className="overflow-y-auto p-5">
          <Section title="Customer">
            <div className="flex items-center justify-between rounded-xl border-2 bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-blue)] text-base font-extrabold text-white">
                  {customer
                    ? customer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                    : "WI"}
                </div>
                <div>
                  <div className="text-base font-extrabold">
                    {customer ? customer.name : "Walk-in Customer"}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {customer
                      ? [customer.mobile, customer.area].filter(Boolean).join(" · ") ||
                        "Contact details unavailable"
                      : "No customer attached"}
                  </div>
                </div>
              </div>
              <Link
                to="/customers"
                search={{ returnTo: "/checkout" }}
                className="tap-target inline-flex items-center justify-center rounded-xl bg-[var(--secondary)] px-4 text-center font-bold active:scale-95"
              >
                {customer ? "Change" : "Add"}
              </Link>
            </div>
            {customer && (
              <label
                className={`mt-3 flex items-center justify-between rounded-xl border-2 bg-card p-4 transition-all ${hasMarkdown ? "cursor-not-allowed opacity-50" : "cursor-pointer active:scale-[0.99]"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--secondary)]">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold">Home Delivery</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {homeDelivery
                        ? deliveryFee === 0
                          ? "Free delivery"
                          : `₹30 delivery fee`
                        : hasMarkdown
                          ? "Unavailable for markdown-labelled stock"
                          : "Add delivery"}
                    </div>
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasMarkdown) setHomeDelivery(!homeDelivery);
                  }}
                  className={
                    "relative h-7 w-12 shrink-0 rounded-full transition-colors " +
                    (homeDelivery ? "bg-[var(--brand-blue)]" : "bg-muted-foreground/30")
                  }
                >
                  <div
                    className={
                      "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform " +
                      (homeDelivery ? "translate-x-5" : "translate-x-0")
                    }
                  />
                </div>
              </label>
            )}
          </Section>

          <Section title="Payment Method">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {PAYMENTS.map((p) => {
                const Icon = p.icon;
                const active = payment === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
                    disabled={paytmRequestActive}
                    className={
                      "tap-target-lg flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-4 font-bold transition-all active:scale-[0.97] " +
                      (active
                        ? "border-transparent text-white shadow-md"
                        : "border-border bg-card text-foreground")
                    }
                    style={active ? { backgroundColor: p.color } : undefined}
                  >
                    <Icon className="h-7 w-7" strokeWidth={2.25} />
                    <span className="text-sm">{p.label}</span>
                  </button>
                );
              })}
            </div>
            {payment === "Split" ? (
              <div className="mt-4 rounded-2xl border-2 bg-card p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Split Payment Allocation
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(["CASH", "UPI", "CARD", "WALLET"] as const).map((mode) => (
                    <label key={mode} className="rounded-xl border bg-background px-3 py-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {mode}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={splitPayments[mode]}
                        onChange={(event) =>
                          setSplitPayments((current) => ({
                            ...current,
                            [mode]: event.target.value,
                          }))
                        }
                        className="mt-1 w-full bg-transparent text-lg font-extrabold tabular-nums focus:outline-none"
                        placeholder="0.00"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--secondary)] px-4 py-3">
                  <span className="text-sm font-bold uppercase tracking-wide">Split Total</span>
                  <span
                    className={
                      "text-lg font-extrabold tabular-nums " +
                      (hasValidSplit ? "text-[var(--brand-green)]" : "text-[var(--brand-red)]")
                    }
                  >
                    {formatINR(splitPaymentTotal)} / {formatINR(authoritativeTotal)}
                  </span>
                </div>
                {splitInvalid ? (
                  <div className="mt-2 rounded-xl border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/5 px-3 py-2 text-sm font-semibold text-[var(--brand-red)]">
                    Split payment amounts must add up exactly before checkout.
                  </div>
                ) : null}
              </div>
            ) : null}
            {payment === "Paytm POS" && paytmState !== "idle" ? (
              <div className="mt-4 border-2 bg-card p-4">
                <div className="flex items-start gap-3">
                  {paytmState === "failed" ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-red)]" />
                  ) : (
                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#00a8e8]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">{getPaytmStatusTitle(paytmState)}</div>
                    <div className="mt-1 text-sm font-medium text-muted-foreground">
                      {paytmMessage || "Payment request sent to Paytm device"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {paytmState === "waiting" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPaytmPollingEnabled(true);
                          void paytmStatusQuery.refetch();
                        }}
                        className="tap-target inline-flex items-center gap-2 border-2 bg-background px-4 font-bold"
                      >
                        <RefreshCw className="h-4 w-4" /> Check now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaytmState("stopped");
                          setPaytmPollingEnabled(false);
                        }}
                        className="tap-target inline-flex items-center gap-2 border-2 bg-background px-4 font-bold"
                      >
                        <Pause className="h-4 w-4" /> Stop polling
                      </button>
                    </>
                  ) : null}
                  {paytmState === "stopped" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPaytmState("waiting");
                        setPaytmPollingEnabled(true);
                      }}
                      className="tap-target inline-flex items-center gap-2 bg-[#00a8e8] px-4 font-bold text-white"
                    >
                      <RefreshCw className="h-4 w-4" /> Resume status checks
                    </button>
                  ) : null}
                  {paytmState === "failed" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          resetPaytm();
                          paytmMutation.mutate();
                        }}
                        className="tap-target inline-flex items-center gap-2 bg-[#00a8e8] px-4 font-bold text-white"
                      >
                        <RefreshCw className="h-4 w-4" /> Retry Paytm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetPaytm();
                          setPayment("UPI");
                        }}
                        className="tap-target border-2 bg-background px-4 font-bold"
                      >
                        Use manual payment
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Section>
        </div>

        <aside className="flex flex-col overflow-hidden border-t-2 bg-card lg:border-l-2 lg:border-t-0">
          <div className="flex-1 overflow-y-auto p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Order Summary
            </h3>
            <ul className="space-y-2 text-sm">
              {items.map((i) => (
                <li
                  key={i.product.lineKey || i.product._id}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{i.product.name}</div>
                    {i.product.markdownCode ? (
                      <div className="text-[10px] font-extrabold text-[var(--brand-orange)]">
                        MARKDOWN · {i.product.batchNumber}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {i.product.sellingMode === "WEIGHT"
                        ? `Weight: ${formatWeight(i.qty)} · Rate: ${formatINR(i.product.price)} per KG`
                        : `${i.qty} × ${formatINR(i.product.price)}`}
                    </div>
                  </div>
                  <div className="font-extrabold tabular-nums">
                    {formatINR(i.product.price * i.qty)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <SumRow
                label="Quoted Subtotal"
                value={formatINR(quote?.totals.subtotal ?? subtotal)}
              />
              <SumRow
                label="Catalog Discount"
                value={"– " + formatINR(quotedCatalogDiscount)}
                positive
              />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                  <Percent className="h-3.5 w-3.5" /> Extra
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  disabled={hasMarkdown}
                  onChange={(e) =>
                    setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                  }
                  title={
                    hasMarkdown
                      ? "Extra discounts cannot be stacked with markdown pricing"
                      : undefined
                  }
                  className="w-20 rounded-lg border-2 bg-background px-2 py-1 text-right font-bold tabular-nums disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:border-[var(--brand-blue)]"
                />
              </div>
              {(quote?.appliedOffers ?? []).map((offer) => (
                <SumRow
                  key={offer.promotionId}
                  label={offer.name || "Automatic promotion"}
                  value={"– " + formatINR(offer.discountAmount)}
                  positive
                />
              ))}
              {Number(quote?.totals.manualDiscount ?? extraDiscount) > 0 && (
                <SumRow
                  label="Extra Discount"
                  value={"– " + formatINR(quote?.totals.manualDiscount ?? extraDiscount)}
                  positive
                />
              )}
              {homeDelivery && (
                <SumRow
                  label="Delivery"
                  value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)}
                />
              )}
              <SumRow label="GST (Included in price)" value={formatINR(quote?.totals.tax ?? tax)} />
            </div>
            <div className="mt-3 flex items-end justify-between border-t pt-3">
              <span className="text-sm font-bold uppercase tracking-wide">Grand Total</span>
              <span className="text-3xl font-extrabold tabular-nums">
                {formatINR(authoritativeTotal)}
              </span>
            </div>
            {quoteUnavailable ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                {quoteQuery.isError ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>Unable to confirm current price.</span>
                    <button
                      type="button"
                      className="font-extrabold underline"
                      onClick={() => void quoteQuery.refetch()}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  "Confirming current price…"
                )}
              </div>
            ) : null}
            {activeOrderId ? (
              <div className="mt-3 rounded-xl bg-[var(--secondary)] px-4 py-3 text-sm font-semibold text-muted-foreground">
                Completing resumed order #{activeOrderId.slice(-6).toUpperCase()}
              </div>
            ) : null}
          </div>
          {checkoutError && (
            <div className="mx-3 flex items-start gap-2 rounded-xl border-2 border-[var(--brand-red)]/30 bg-[var(--brand-red)]/5 p-3 text-sm font-semibold text-[var(--brand-red)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-line">{checkoutError}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (payment === "Paytm POS") paytmMutation.mutate();
              else checkoutMutation.mutate();
            }}
            disabled={submitDisabled}
            className="m-3 flex min-h-[88px] items-center justify-center gap-3 rounded-2xl bg-[var(--brand-green)] text-xl font-extrabold text-white shadow-lg disabled:opacity-60 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <>
                {payment === "Paytm POS" ? "SEND TO PAYTM" : "PLACE ORDER"} ·{" "}
                {formatINR(authoritativeTotal)}
              </>
            )}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SumRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className={"font-bold tabular-nums " + (positive ? "text-[var(--brand-green)]" : "")}>
        {value}
      </span>
    </div>
  );
}
