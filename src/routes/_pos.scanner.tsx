import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PRODUCTS, formatINR } from "@/lib/pos-data";
import { useCart } from "@/lib/cart-context";
import { ScanLine, Plus, Minus, ArrowRight, X } from "lucide-react";

export const Route = createFileRoute("/_pos/scanner")({
  head: () => ({ meta: [{ title: "Scanner — CHOTA BAZAAR POS" }] }),
  component: ScannerPage,
});

function ScannerPage() {
  const [detectedIdx, setDetectedIdx] = useState(0);
  const product = PRODUCTS[detectedIdx];
  const { add, inc, dec, items, count, total } = useCart();
  const cartLine = items.find((i) => i.product.id === product.id);
  const navigate = useNavigate();

  const simulateScan = () => {
    setDetectedIdx((i) => (i + 1) % PRODUCTS.length);
    add(PRODUCTS[(detectedIdx + 1) % PRODUCTS.length]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-[var(--brand-yellow)]" />
          <div>
            <div className="text-sm font-extrabold uppercase tracking-wide">Scanner Mode</div>
            <div className="text-xs text-white/70">Point camera at barcode · rapid billing</div>
          </div>
        </div>
        <Link
          to="/new-order"
          className="tap-target grid place-items-center rounded-xl bg-white/10 px-4 font-bold"
        >
          <X className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_420px]">
        {/* Camera viewport */}
        <div className="relative overflow-hidden bg-zinc-900">
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative h-[60%] w-[70%] max-w-2xl">
              <div className="absolute inset-0 rounded-3xl border-4 border-dashed border-[var(--brand-yellow)]/60" />
              <div className="absolute left-1/2 top-1/2 h-1 w-[80%] -translate-x-1/2 -translate-y-1/2 animate-pulse bg-[var(--brand-red)] shadow-[0_0_20px_var(--brand-red)]" />
              <div className="absolute -top-8 left-0 right-0 text-center text-xs font-bold uppercase tracking-widest text-[var(--brand-yellow)]">
                Align barcode within frame
              </div>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1fr_1fr] gap-2 p-4">
            <button
              onClick={simulateScan}
              className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-green)] text-lg font-extrabold text-white active:scale-[0.98]"
            >
              <ScanLine className="h-6 w-6" /> Simulate Scan
            </button>
            <button
              onClick={() => navigate({ to: "/checkout" })}
              disabled={items.length === 0}
              className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-blue)] text-lg font-extrabold text-white disabled:opacity-40 active:scale-[0.98]"
            >
              Checkout <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Detected product + cart strip */}
        <aside className="flex flex-col overflow-hidden border-l border-white/10 bg-zinc-950">
          <div className="border-b border-white/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-yellow)]">Last Detected</div>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-white/5 p-3">
              <div className="grid h-20 w-20 place-items-center rounded-xl bg-white text-5xl">{product.emoji}</div>
              <div className="min-w-0">
                <div className="truncate text-lg font-extrabold leading-tight">{product.name}</div>
                <div className="text-xs font-semibold text-white/60">{product.weight} · {product.barcode}</div>
                <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--brand-yellow)]">
                  {formatINR(product.price)}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                onClick={() => cartLine && dec(product.id)}
                className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 active:scale-95"
              >
                <Minus className="h-5 w-5" strokeWidth={3} />
              </button>
              <div className="rounded-xl bg-white/5 py-3 text-center text-2xl font-extrabold tabular-nums">
                {cartLine?.qty ?? 0}
              </div>
              <button
                onClick={() => (cartLine ? inc(product.id) : add(product))}
                className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-green)] text-white active:scale-95"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-white/60">Cart · {count} items</div>
            <ul className="mt-2 space-y-1.5">
              {items.length === 0 && (
                <li className="rounded-xl bg-white/5 p-4 text-center text-sm font-semibold text-white/60">
                  Scan to add items
                </li>
              )}
              {items.map((i) => (
                <li key={i.product.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-white/5 p-2.5 text-sm">
                  <div className="truncate font-bold">{i.product.name}</div>
                  <div className="rounded-md bg-white/10 px-2 py-0.5 font-extrabold tabular-nums">× {i.qty}</div>
                  <div className="font-extrabold tabular-nums">{formatINR(i.product.price * i.qty)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/10 bg-black p-4">
            <div className="flex items-end justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-white/60">Total</span>
              <span className="text-3xl font-extrabold tabular-nums text-[var(--brand-yellow)]">{formatINR(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
