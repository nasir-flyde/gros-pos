import { Link, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/cart-context";
import { orderApi } from "@/lib/order-api";
import { formatINR } from "@/lib/utils";
import { Plus, Minus, Trash2, Pause, ArrowRight, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CartPanel() {
  const {
    items,
    inc,
    dec,
    remove,
    subtotal,
    discount,
    afterDisc,
    tax,
    count,
    clear,
    customer,
    activeOrderId,
    setActiveOrderId,
  } = useCart();
  // GST is inclusive in afterDisc — do NOT add tax again
  const cartTotal = afterDisc;
  const navigate = useNavigate();
  const [holding, setHolding] = useState(false);

  const holdCurrentOrder = async () => {
    if (!activeOrderId) {
      toast.error("Backend hold is only available for an existing resumed order right now.");
      return;
    }

    try {
      setHolding(true);
      await orderApi.hold(activeOrderId);
      clear();
      setActiveOrderId(null);
      toast.success("Order placed on hold");
      navigate({ to: "/hold" });
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Failed to hold order";
      toast.error(message);
    } finally {
      setHolding(false);
    }
  };

  return (
    <aside className="flex w-full max-w-[420px] shrink-0 flex-col overflow-hidden border-l-2 bg-card lg:w-[38%]">
      <div className="flex items-center justify-between border-b bg-[var(--brand-blue)] px-4 py-3 text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Current Cart
          </div>
          <div className="text-lg font-extrabold leading-tight">
            {count} {count === 1 ? "item" : "items"}
          </div>
        </div>
        <Link
          to="/customers"
          className="tap-target flex items-center justify-center rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold text-white active:scale-[0.97]"
        >
          {customer ? customer.name.split(" ")[0] : "+ Customer"}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="grid h-full place-items-center p-6 text-center text-muted-foreground">
            <div>
              <div className="text-6xl">🛒</div>
              <div className="mt-3 text-base font-bold text-foreground">Cart is empty</div>
              <div className="mt-1 text-sm">Scan or tap products to start billing</div>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.product._id} className="flex items-start gap-3 px-4 py-3">
                <ImagePreview src={i.product.imageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold leading-tight">{i.product.name}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    {i.product.weight} · {formatINR(i.product.price)}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => dec(i.product._id)}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--secondary)] active:scale-95"
                    >
                      <Minus className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-base font-extrabold tabular-nums">
                      {i.qty}
                    </span>
                    <button
                      onClick={() => inc(i.product._id)}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-blue)] text-white active:scale-95"
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-base font-extrabold tabular-nums">
                    {formatINR(i.product.price * i.qty)}
                  </div>
                  <button
                    onClick={() => remove(i.product._id)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t bg-[var(--surface)] px-4 py-3 text-sm">
        <Row label="Subtotal (MRP)" value={formatINR(subtotal)} />
        <Row label="Discount" value={"– " + formatINR(discount)} positive />
        <Row label="GST (Included)" value={formatINR(tax)} />
        <div className="mt-2 flex items-baseline justify-between border-t pt-2">
          <div className="text-sm font-bold uppercase tracking-wide">Grand Total</div>
          <div className="text-2xl font-extrabold tabular-nums">{formatINR(cartTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-[auto_auto_1fr] gap-2 border-t bg-card p-3">
        <button
          disabled={items.length === 0}
          onClick={() => clear()}
          className="tap-target-lg grid place-items-center rounded-xl bg-[var(--secondary)] px-3 font-bold text-foreground disabled:opacity-40 active:scale-[0.97]"
          aria-label="Clear cart"
        >
          <Trash2 className="h-5 w-5" />
        </button>
        <button
          disabled={items.length === 0}
          onClick={holdCurrentOrder}
          className="tap-target-lg grid place-items-center rounded-xl bg-[var(--brand-orange)] px-3 font-bold text-white disabled:opacity-40 active:scale-[0.97]"
          aria-label="Hold order"
        >
          <Pause className={"h-5 w-5 " + (holding ? "animate-pulse" : "")} />
        </button>
        <button
          disabled={items.length === 0}
          onClick={() => navigate({ to: "/checkout" })}
          className="tap-target-lg flex min-h-[80px] items-center justify-center gap-3 rounded-xl bg-[var(--brand-green)] text-lg font-extrabold text-white shadow-md disabled:opacity-40 active:scale-[0.98]"
        >
          <span>Checkout · {formatINR(cartTotal)}</span>
          <ArrowRight className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
    </aside>
  );
}

function ImagePreview({ src }: { src?: string }) {
  const [fallback, setFallback] = useState(false);
  if (!src || fallback) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--secondary)]">
        <Package className="h-6 w-6 text-muted-foreground/60" />
      </div>
    );
  }
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--secondary)]">
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setFallback(true)}
      />
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className={"font-bold tabular-nums " + (positive ? "text-[var(--brand-green)]" : "")}>
        {value}
      </span>
    </div>
  );
}
