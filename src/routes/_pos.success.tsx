import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/utils";
import { CheckCircle2, Printer, Bike, Plus } from "lucide-react";

export const Route = createFileRoute("/_pos/success")({
  head: () => ({ meta: [{ title: "Order Placed — CHOTA BAZAAR POS" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { lastCheckout, items } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastCheckout) navigate({ to: "/new-order" });
  }, [lastCheckout, navigate]);

  if (!lastCheckout) return null;
  const { orderId, customer, total, payment, delivery, receiptData } = lastCheckout;

  const rd = receiptData as Record<string, unknown> | undefined;

  // receiptData shape: if generateReceipt succeeded it's nested under .receiptData,
  // otherwise the fallback in-memory receipt has values at the top level.
  const rdNested = (rd?.receiptData ?? rd) as Record<string, unknown>;
  const rdItems =
    (rdNested?.items as Array<Record<string, unknown>>) ||
    (rd?.items as Array<Record<string, unknown>>) ||
    [];
  const storeInfo = (rdNested?.storeInfo ?? rd?.storeInfo) as Record<string, unknown> | undefined;
  const paid = (rdNested?.paid as number) ?? (rd?.paid as number) ?? total;
  const changeAmount = (rdNested?.changeAmount as number) ?? (rd?.changeAmount as number) ?? 0;
  const subtotal = (rdNested?.subtotal as number) ?? (rd?.subtotal as number) ?? 0;
  const discount = (rdNested?.discount as number) ?? (rd?.discount as number) ?? 0;
  const tax = (rdNested?.tax as number) ?? (rd?.tax as number) ?? 0;
  const deliveryCharge = (rdNested?.delivery as number) ?? (rd?.delivery as number) ?? 0;

  const printReceipt = () => {
    const printContent = document.getElementById("receipt-print");
    if (!printContent) return;
    const original = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };

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

          {/* Receipt Preview */}
          <div
            id="receipt-print"
            className="mx-auto mt-6 max-w-sm rounded-2xl border-2 bg-white p-5 text-left font-mono text-xs leading-relaxed text-black shadow-sm"
          >
            <div className="text-center">
              <div className="text-base font-extrabold tracking-tight">
                {(storeInfo?.storeName as string) || "CHOTA BAZAAR"}
              </div>
              {storeInfo?.address && (
                <div className="mt-0.5 text-[10px] text-gray-600">
                  {[
                    (storeInfo.address as Record<string, string>)?.line1,
                    (storeInfo.address as Record<string, string>)?.line2,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              {storeInfo?.phone && (
                <div className="text-[10px] text-gray-600">Tel: {storeInfo.phone as string}</div>
              )}
              {storeInfo?.gstNumber && (
                <div className="text-[10px] text-gray-600">
                  GST: {storeInfo.gstNumber as string}
                </div>
              )}
            </div>

            <div className="my-2 border-t border-dashed border-gray-300" />

            <div className="flex justify-between">
              <span>Order: {orderId}</span>
              <span>{new Date().toLocaleDateString("en-IN")}</span>
            </div>

            <div className="my-2 border-t border-dashed border-gray-300" />

            <div className="flex justify-between font-bold">
              <span>Item</span>
              <span>Qty × Price</span>
              <span>Total</span>
            </div>

            {(rdItems.length > 0 ? rdItems : []).map(
              (item: Record<string, unknown>, idx: number) => (
                <div key={idx} className="mt-1 flex justify-between">
                  <span className="max-w-[140px] truncate">
                    {(item.variantName as string) || (item.sku as string) || `Item ${idx + 1}`}
                  </span>
                  <span className="tabular-nums">
                    {item.quantity as number} × {formatINR(item.unitPrice as number)}
                  </span>
                  <span className="tabular-nums">{formatINR(item.lineTotal as number)}</span>
                </div>
              ),
            )}

            <div className="my-2 border-t border-dashed border-gray-300" />

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatINR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className="tabular-nums text-[var(--brand-green)]">
                    -{formatINR(discount)}
                  </span>
                </div>
              )}
              {deliveryCharge > 0 && (
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span className="tabular-nums">{formatINR(deliveryCharge)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST</span>
                <span className="tabular-nums">{formatINR(tax)}</span>
              </div>
            </div>

            <div className="my-2 border-t-2 border-double border-gray-400 pt-1">
              <div className="flex justify-between text-sm font-extrabold">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-[10px]">
                <span>Paid ({payment})</span>
                <span className="tabular-nums">{formatINR(paid)}</span>
              </div>
              {changeAmount > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Change</span>
                  <span className="tabular-nums">{formatINR(changeAmount)}</span>
                </div>
              )}
            </div>

            <div className="mt-2 text-center text-[10px] text-gray-500">
              Thank you for your purchase!
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Action
              color="var(--brand-blue)"
              icon={Printer}
              label="Print Receipt"
              onClick={printReceipt}
            />
            {delivery === "Home" && (
              <Action
                color="var(--brand-orange)"
                icon={Bike}
                label="Assign Rider"
                onClick={() => navigate({ to: "/delivery", search: { orderId } })}
              />
            )}
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
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-extrabold">{value}</div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
