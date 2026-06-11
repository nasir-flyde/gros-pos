import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/pos-data";
import { CheckCircle2, Printer, MessageCircle, Bike, Plus } from "lucide-react";

export const Route = createFileRoute("/_pos/success")({
  head: () => ({ meta: [{ title: "Order Placed — CHOTA BAZAAR POS" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { lastCheckout } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastCheckout) navigate({ to: "/new-order" });
  }, [lastCheckout, navigate]);

  if (!lastCheckout) return null;
  const { orderId, customer, total, payment, delivery } = lastCheckout;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border-2 border-[var(--brand-green)]/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-green)] text-white shadow-md">
            <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Order Placed!</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Receipt ready to print or share on WhatsApp
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-left md:grid-cols-4">
            <Info label="Order Number" value={orderId} />
            <Info label="Customer" value={customer ? customer.name : "Walk-in"} />
            <Info label="Payment" value={payment} />
            <Info label="Type" value={delivery} />
          </div>

          <div className="mt-6 rounded-2xl bg-[var(--brand-blue)] px-6 py-5 text-white">
            <div className="text-xs font-bold uppercase tracking-wide text-white/70">Total Paid</div>
            <div className="text-5xl font-extrabold tabular-nums">{formatINR(total)}</div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Action color="var(--brand-blue)" icon={Printer} label="Print Receipt" />
            <Action color="var(--brand-green)" icon={MessageCircle} label="WhatsApp" />
            <Action color="var(--brand-orange)" icon={Bike} label="Assign Rider" to="/delivery" />
            <Action color="var(--brand-red)" icon={Plus} label="New Order" to="/new-order" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--secondary)] p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-extrabold">{value}</div>
    </div>
  );
}
function Action({
  icon: Icon, label, color, to,
}: { icon: typeof Printer; label: string; color: string; to?: string }) {
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
    <button className={cls} style={{ backgroundColor: color }}>
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}
