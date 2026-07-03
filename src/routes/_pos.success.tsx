import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useCart } from "@/lib/cart-context";
import { normalizeReceiptData, isReceiptPrintable, type ReceiptStatus } from "@/lib/receipt";
import { printNormalizedReceipt } from "@/lib/receipt-print";
import { CheckCircle2, Printer, Bike, Plus, Download } from "lucide-react";
import { ReceiptPrintContent } from "@/components/receipt/receipt-print-content";

export const Route = createFileRoute("/_pos/success")({
  head: () => ({ meta: [{ title: "Order Placed — CHHOTA BAZAAR POS" }] }),
  component: SuccessPage,
});

type SavedCheckout = {
  payment: "Cash" | "UPI" | "Card" | "Wallet" | "Split";
  delivery: "Home" | "Pickup" | "Walk-Out";
  orderId: string;
  orderObjectId?: string;
  total: number;
  receiptData?: Record<string, unknown>;
  receiptStatus?: ReceiptStatus;
  receiptWarning?: string;
  customer: {
    _id: string;
    name: string;
    mobile: string;
    area?: string;
  } | null;
};

function getSavedCheckout() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("pos_last_checkout");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedCheckout;
  } catch {
    return null;
  }
}

export function SuccessPage() {
  const { lastCheckout } = useCart();
  const navigate = useNavigate();
  const savedCheckout = useMemo(() => getSavedCheckout(), []);
  const checkout = lastCheckout ?? savedCheckout;

  useEffect(() => {
    if (!checkout) navigate({ to: "/new-order" });
  }, [checkout, navigate]);

  const receipt = useMemo(() => {
    if (!checkout) return null;
    return normalizeReceiptData(checkout.receiptData, {
      orderId: checkout.orderId,
      total: checkout.total,
      payment: checkout.payment,
      delivery: checkout.delivery,
      customer: checkout.customer,
    });
  }, [checkout]);

  const downloadTriggered = useRef(false);
  useEffect(() => {
    if (downloadTriggered.current) return;
    if (!receipt || !isReceiptPrintable(checkout?.receiptStatus)) return;

    const timer = setTimeout(() => {
      void printNormalizedReceipt(receipt).then((printed) => {
        if (printed) {
          downloadTriggered.current = true;
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [checkout?.receiptStatus, receipt]);

  const receiptStatus = checkout?.receiptStatus;
  const receiptUnavailable = receiptStatus === "unavailable";
  const receiptPending = receiptStatus === "pending_fulfillment";
  const receiptWarning = checkout?.receiptWarning;

  const printReceipt = async () => {
    if (!receipt) return;
    await printNormalizedReceipt(receipt);
  };

  const downloadReceipt = async () => {
    if (!receipt) return;
    if (await printNormalizedReceipt(receipt)) {
      downloadTriggered.current = true;
    }
  };

  if (!receipt && !receiptUnavailable && !receiptPending) return null;

  if (!receipt && receiptUnavailable) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-[var(--brand-green)]/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-green)] text-white shadow-md">
            <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Order Placed!</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            The sale is complete, but the receipt could not be generated right now.
          </p>
          {receiptWarning && (
            <p className="mt-3 rounded-2xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 px-4 py-3 text-sm font-semibold text-[var(--brand-orange)]">
              {receiptWarning}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/new-order"
              className="inline-flex tap-target items-center rounded-2xl bg-[var(--brand-blue)] px-5 font-bold text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt && receiptPending) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl rounded-3xl border-2 border-[var(--brand-orange)]/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-orange)] text-white shadow-md">
            <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Order Placed!</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Receipt will be available after fulfillment or pickup confirmation.
          </p>
          {receiptWarning && (
            <p className="mt-3 rounded-2xl border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 px-4 py-3 text-sm font-semibold text-[var(--brand-orange)]">
              {receiptWarning}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {checkout?.delivery === "Home" || checkout?.delivery === "Pickup" ? (
              <button
                className="inline-flex tap-target items-center rounded-2xl bg-[var(--brand-orange)] px-5 font-bold text-white"
                onClick={() => navigate({ to: "/delivery" })}
              >
                <Bike className="mr-2 h-4 w-4" />
                Open Fulfillment
              </button>
            ) : null}
            <Link
              to="/new-order"
              className="inline-flex tap-target items-center rounded-2xl bg-[var(--brand-blue)] px-5 font-bold text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) return null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border-2 border-[var(--brand-green)]/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-green)] text-white shadow-md">
            <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Order Placed!</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Receipt ready to print
          </p>

          <ReceiptPrintContent receipt={receipt} className="mt-6" />

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Action
              color="var(--brand-blue)"
              icon={Printer}
              label="Print Receipt"
              onClick={printReceipt}
            />
            <Action
              color="var(--brand-green)"
              icon={Download}
              label="Save PDF"
              onClick={downloadReceipt}
            />
            {receipt.delivery === "Home" && (
              <Action
                color="var(--brand-orange)"
                icon={Bike}
                label="Assign Rider"
                onClick={() => navigate({ to: "/delivery", search: { orderId: checkout?.orderObjectId ?? receipt.orderId } })}
              />
            )}
            <Action color="var(--brand-red)" icon={Plus} label="New Order" to="/new-order" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  color,
  to,
  onClick,
}: {
  icon: typeof Printer;
  label: string;
  color: string;
  to?: string;
  onClick?: () => void;
}) {
  const cls =
    "tap-target-lg flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-sm font-bold text-white shadow-sm active:scale-[0.97]";
  if (to) {
    return (
      <Link to={to as "/new-order"} className={cls} style={{ backgroundColor: color }}>
        <Icon className="h-6 w-6" />
        {label}
      </Link>
    );
  }
  return (
    <button className={cls} style={{ backgroundColor: color }} onClick={onClick}>
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}
