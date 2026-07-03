import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCart } from "@/lib/cart-context";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type PosOrder } from "@/lib/order-api";
import type { CheckoutPayment } from "@/lib/order-payload";
import {
  buildSplitPaymentEntries,
  buildPosCheckoutPayload,
  hasExactPaymentTotal,
  resolveCheckoutPayments,
  roundCurrency,
} from "@/lib/checkout-flow";
import { formatINR } from "@/lib/utils";
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
} from "lucide-react";

export const Route = createFileRoute("/_pos/checkout")({
  head: () => ({ meta: [{ title: "Checkout — CHHOTA BAZAAR POS" }] }),
  component: CheckoutPage,
});

const PAYMENTS = [
  { id: "Cash" as const, label: "Cash", icon: Banknote, color: "var(--brand-green)" },
  { id: "UPI" as const, label: "UPI", icon: Smartphone, color: "var(--brand-blue)" },
  { id: "Card" as const, label: "Card", icon: CreditCard, color: "var(--brand-orange)" },
  { id: "Wallet" as const, label: "Wallet", icon: Wallet, color: "var(--brand-red)" },
  { id: "Split" as const, label: "Split", icon: Split, color: "var(--brand-blue)" },
] as const;

function CheckoutPage() {
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
  } = useCart();
  const authUser = useAuthStore((s) => s.user);
  const scopes = useAuthStore((s) => s.scopes);
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]["id"]>("UPI");
  const [homeDelivery, setHomeDelivery] = useState(false);
  const [discountPct, setDiscountPct] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [splitPayments, setSplitPayments] = useState<Record<CheckoutPayment["paymentMode"], string>>({
    CASH: "",
    UPI: "",
    CARD: "",
    WALLET: "",
  });
  const navigate = useNavigate();

  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";
  const cashierId = authUser?.id ?? "";
  const noStore = !storeId;

  const sellingSubtotal = afterDisc;
  const deliveryFee = homeDelivery ? (sellingSubtotal > 500 ? 0 : 30) : 0;
  const extraDiscount = sellingSubtotal > 0 ? Math.round(sellingSubtotal * discountPct / 100) : 0;
  // GST is inclusive in the selling subtotal — do NOT add tax again
  const grandTotal = sellingSubtotal + deliveryFee - extraDiscount;
  const roundedGrandTotal = roundCurrency(grandTotal);

  const splitPaymentEntries: CheckoutPayment[] = buildSplitPaymentEntries(splitPayments);
  const splitPaymentTotal = splitPaymentEntries.reduce((sum, payment) => sum + payment.amount, 0);
  const hasValidSplit = hasExactPaymentTotal(splitPaymentEntries, roundedGrandTotal);
  const resolvedPayments: CheckoutPayment[] = resolveCheckoutPayments(
    payment,
    roundedGrandTotal,
    splitPayments,
  );

  const checkoutMutation = useMutation({
    mutationFn: () => {
      setCheckoutError(null);
      if (noStore) throw new Error("No store assigned to your account. Contact admin.");
      if (payment === "Split" && !hasValidSplit) {
        throw new Error("Split payment amounts must add up exactly to the grand total.");
      }
      const payload = buildPosCheckoutPayload({
        cartItems: items,
        payment,
        grandTotal: roundedGrandTotal,
        splitPayments,
        deliveryType: homeDelivery ? "Home" : "Walk-Out",
        storeId,
        cashierId,
        charges: {
          delivery: deliveryFee,
          // Product prices are already discounted before checkout; only send the manual extra discount.
          discount: extraDiscount,
          discountPercent: extraDiscount > 0 ? discountPct : undefined,
        },
        customerId: customer?._id,
        orderId: activeOrderId ?? undefined,
      });
      return orderApi.checkout(payload);
    },
    onSuccess: (res) => {
      const result = res.data;
      const checkoutOrder = result.order as PosOrder;
      const deliveryLabel: "Home" | "Walk-Out" = homeDelivery ? "Home" : "Walk-Out";
      const checkoutSummary = {
        orderId: checkoutOrder.orderNumber,
        orderObjectId: checkoutOrder._id,
        payment,
        delivery: deliveryLabel,
        total: roundedGrandTotal,
        receiptData: (result.receipt as Record<string, unknown> | null) ?? undefined,
        receiptStatus: result.receiptStatus,
        receiptWarning: result.receiptWarning,
        customer: customer
          ? { _id: customer._id, name: customer.name, mobile: customer.mobile, area: customer.area }
          : null,
      };
      setLastCheckout(checkoutSummary);
      sessionStorage.setItem("pos_last_checkout", JSON.stringify(checkoutSummary));
      clear();
      navigate({ to: "/success" });
    },
    onError: (err: unknown) => {
      const e = err as {
        message?: string;
        details?: { fields?: Array<{ field: string; message: string }> };
      };
      if (e?.details?.fields?.length) {
        const items = e.details.fields.map((f) => `• ${f.field}: ${f.message}`);
        setCheckoutError(items.join("\n"));
      } else {
        setCheckoutError(e?.message || "Checkout failed. Please try again.");
      }
    },
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
                    {customer ? `${customer.mobile} · ${customer.area}` : "No customer attached"}
                  </div>
                </div>
              </div>
              <Link
                to="/customers"
                className="tap-target rounded-xl bg-[var(--secondary)] px-4 font-bold active:scale-95"
              >
                {customer ? "Change" : "Add"}
              </Link>
            </div>
            {customer && (
              <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border-2 bg-card p-4 transition-all active:scale-[0.99]">
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
                        : "Add delivery"}
                    </div>
                  </div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setHomeDelivery(!homeDelivery);
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {PAYMENTS.map((p) => {
                const Icon = p.icon;
                const active = payment === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPayment(p.id)}
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
                  <span className={"text-lg font-extrabold tabular-nums " + (hasValidSplit ? "text-[var(--brand-green)]" : "text-[var(--brand-red)]")}>
                    {formatINR(splitPaymentTotal)} / {formatINR(roundedGrandTotal)}
                  </span>
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
                <li key={i.product._id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{i.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.qty} × {formatINR(i.product.price)}
                    </div>
                  </div>
                  <div className="font-extrabold tabular-nums">
                    {formatINR(i.product.price * i.qty)}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <SumRow label="Subtotal (MRP)" value={formatINR(subtotal)} />
              <SumRow label="Catalog Discount" value={"– " + formatINR(discount)} positive />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                  <Percent className="h-3.5 w-3.5" /> Extra
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="w-20 rounded-lg border-2 bg-background px-2 py-1 text-right font-bold tabular-nums focus:outline-none focus:border-[var(--brand-blue)]"
                />
              </div>
              {extraDiscount > 0 && (
                <SumRow label="Extra Discount" value={"– " + formatINR(extraDiscount)} positive />
              )}
              {homeDelivery && (
                <SumRow
                  label="Delivery"
                  value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)}
                />
              )}
              <SumRow label="GST (Included in price)" value={formatINR(tax)} />
            </div>
            <div className="mt-3 flex items-end justify-between border-t pt-3">
              <span className="text-sm font-bold uppercase tracking-wide">Grand Total</span>
              <span className="text-3xl font-extrabold tabular-nums">{formatINR(grandTotal)}</span>
            </div>
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
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            className="m-3 flex min-h-[88px] items-center justify-center gap-3 rounded-2xl bg-[var(--brand-green)] text-xl font-extrabold text-white shadow-lg disabled:opacity-60 active:scale-[0.98]"
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <>PLACE ORDER · {formatINR(grandTotal)}</>
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
