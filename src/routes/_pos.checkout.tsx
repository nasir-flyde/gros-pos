import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/pos-data";
import { Banknote, Smartphone, CreditCard, Wallet, Split, Home, ShoppingBag, Footprints, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_pos/checkout")({
  head: () => ({ meta: [{ title: "Checkout — CHOTA BAZAAR POS" }] }),
  component: CheckoutPage,
});

const PAYMENTS = [
  { id: "Cash", label: "Cash", icon: Banknote, color: "var(--brand-green)" },
  { id: "UPI", label: "UPI", icon: Smartphone, color: "var(--brand-blue)" },
  { id: "Card", label: "Card", icon: CreditCard, color: "var(--brand-orange)" },
  { id: "Wallet", label: "Wallet", icon: Wallet, color: "var(--brand-red)" },
  { id: "Split", label: "Split", icon: Split, color: "var(--brand-blue)" },
] as const;

const DELIVERY = [
  { id: "Home", label: "Home Delivery", sub: "Assign rider after checkout", icon: Home },
  { id: "Pickup", label: "Store Pickup", sub: "Customer collects from counter", icon: ShoppingBag },
  { id: "Walk-Out", label: "Walk-Out", sub: "Customer leaves with cart", icon: Footprints },
] as const;

function CheckoutPage() {
  const { items, customer, subtotal, discount, delivery, tax, total, clear, setLastCheckout } = useCart();
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]["id"]>("UPI");
  const [deliveryMode, setDeliveryMode] = useState<(typeof DELIVERY)[number]["id"]>("Walk-Out");
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <div className="text-6xl">🛒</div>
          <div className="mt-3 text-xl font-bold">Cart is empty</div>
          <Link to="/new-order" className="mt-4 inline-flex tap-target items-center rounded-xl bg-[var(--brand-blue)] px-5 font-bold text-white">
            Start New Order
          </Link>
        </div>
      </div>
    );
  }

  const placeOrder = () => {
    const orderId = "CB-" + Math.floor(24000 + Math.random() * 999);
    setLastCheckout({
      orderId, payment, delivery: deliveryMode, total, customer,
    });
    clear();
    navigate({ to: "/success" });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-card px-4 py-3">
        <Link to="/new-order" className="tap-target grid place-items-center rounded-xl bg-[var(--secondary)] px-3 font-bold active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold leading-tight">Checkout</h1>
          <p className="text-xs font-medium text-muted-foreground">Confirm payment and delivery to finalize</p>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_400px]">
        <div className="overflow-y-auto p-5">
          {/* Customer */}
          <Section title="Customer">
            <div className="flex items-center justify-between rounded-xl border-2 bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-blue)] text-base font-extrabold text-white">
                  {customer ? customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "WI"}
                </div>
                <div>
                  <div className="text-base font-extrabold">{customer ? customer.name : "Walk-in Customer"}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {customer ? `${customer.mobile} · ${customer.area}` : "No customer attached"}
                  </div>
                </div>
              </div>
              <Link to="/customers" className="tap-target rounded-xl bg-[var(--secondary)] px-4 font-bold active:scale-95">
                {customer ? "Change" : "Add"}
              </Link>
            </div>
          </Section>

          {/* Payment */}
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
          </Section>

          {/* Delivery */}
          <Section title="Delivery Type">
            <div className="grid gap-3 md:grid-cols-3">
              {DELIVERY.map((d) => {
                const Icon = d.icon;
                const active = deliveryMode === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDeliveryMode(d.id)}
                    className={
                      "tap-target-lg flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98] " +
                      (active
                        ? "border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white"
                        : "border-border bg-card")
                    }
                  >
                    <div
                      className={
                        "grid h-12 w-12 shrink-0 place-items-center rounded-xl " +
                        (active ? "bg-white/20" : "bg-[var(--secondary)]")
                      }
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold leading-tight">{d.label}</div>
                      <div className={"text-xs font-medium " + (active ? "text-white/80" : "text-muted-foreground")}>
                        {d.sub}
                      </div>
                    </div>
                    {active && <CheckCircle2 className="ml-auto h-6 w-6 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Summary side panel */}
        <aside className="flex flex-col overflow-hidden border-t-2 bg-card lg:border-l-2 lg:border-t-0">
          <div className="flex-1 overflow-y-auto p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Order Summary</h3>
            <ul className="space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.product.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{i.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.qty} × {formatINR(i.product.price)}
                    </div>
                  </div>
                  <div className="font-extrabold tabular-nums">{formatINR(i.product.price * i.qty)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <SumRow label="Subtotal (MRP)" value={formatINR(subtotal)} />
              <SumRow label="Discount" value={"– " + formatINR(discount)} positive />
              <SumRow label="Delivery" value={delivery === 0 ? "FREE" : formatINR(delivery)} />
              <SumRow label="GST (5%)" value={formatINR(tax)} />
            </div>
            <div className="mt-3 flex items-end justify-between border-t pt-3">
              <span className="text-sm font-bold uppercase tracking-wide">Grand Total</span>
              <span className="text-3xl font-extrabold tabular-nums">{formatINR(total)}</span>
            </div>
          </div>
          <button
            onClick={placeOrder}
            className="m-3 flex min-h-[88px] items-center justify-center gap-3 rounded-2xl bg-[var(--brand-green)] text-xl font-extrabold text-white shadow-lg active:scale-[0.98]"
          >
            PLACE ORDER · {formatINR(total)}
          </button>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}
function SumRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className={"font-bold tabular-nums " + (positive ? "text-[var(--brand-green)]" : "")}>{value}</span>
    </div>
  );
}
