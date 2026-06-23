import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { formatINR } from "@/lib/pos-data";
import { Search, Banknote, Smartphone, Wallet, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_pos/returns")({
  head: () => ({ meta: [{ title: "Returns & Refunds — CHOTA BAZAAR POS" }] }),
  component: ReturnsPage,
});

const MOCK_ITEMS = [
  {
    id: "i1",
    name: "Amul Gold Milk 1L",
    qty: 2,
    price: 68,
    eligible: true,
    reason: "Damaged packaging",
  },
  { id: "i2", name: "Britannia Bread 400g", qty: 1, price: 42, eligible: true, reason: "Expired" },
  {
    id: "i3",
    name: "Lays Classic 52g",
    qty: 4,
    price: 20,
    eligible: false,
    reason: "Beyond return window",
  },
];

function ReturnsPage() {
  const [q, setQ] = useState("");
  const total = MOCK_ITEMS.filter((i) => i.eligible).reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="h-full overflow-y-auto p-5">
      <h1 className="text-2xl font-extrabold">Returns & Refunds</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Search a previous order to start a return
      </p>

      <div className="mt-4 flex max-w-2xl items-center gap-2 rounded-2xl border-2 border-[var(--brand-blue)]/30 bg-card px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Order number or mobile number…"
          className="w-full bg-transparent text-lg font-bold focus:outline-none"
        />
        <button className="tap-target rounded-xl bg-[var(--brand-blue)] px-5 font-extrabold text-white active:scale-95">
          Search
        </button>
      </div>

      <div className="mt-5 rounded-2xl border-2 bg-card p-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Order CB-24187
            </div>
            <div className="text-lg font-extrabold">Mohammed Aslam · 9818765432</div>
            <div className="text-xs font-semibold text-muted-foreground">
              Purchased: Today, 12:31 PM
            </div>
          </div>
          <span className="rounded-md bg-[var(--brand-green)]/15 px-3 py-1 text-sm font-extrabold text-[var(--brand-green)]">
            Eligible
          </span>
        </div>

        <ul className="mt-3 divide-y">
          {MOCK_ITEMS.map((it) => (
            <li key={it.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3">
              <div>
                <div className="text-base font-extrabold">{it.name}</div>
                <div className="text-xs font-semibold text-muted-foreground">
                  {it.qty} × {formatINR(it.price)} · Reason: {it.reason}
                </div>
              </div>
              <div className="text-base font-extrabold tabular-nums">
                {formatINR(it.qty * it.price)}
              </div>
              {it.eligible ? (
                <span className="flex items-center gap-1 rounded-md bg-[var(--brand-green)]/15 px-2 py-1 text-xs font-bold text-[var(--brand-green)]">
                  <CheckCircle2 className="h-4 w-4" /> Refund
                </span>
              ) : (
                <span className="rounded-md bg-[var(--brand-red)]/15 px-2 py-1 text-xs font-bold text-[var(--brand-red)]">
                  Not eligible
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-end justify-between rounded-xl bg-[var(--secondary)] p-4">
          <span className="text-sm font-bold uppercase tracking-wide">Refundable Amount</span>
          <span className="text-2xl font-extrabold tabular-nums">{formatINR(total)}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { l: "Cash Refund", c: "var(--brand-green)", i: Banknote },
            { l: "UPI Refund", c: "var(--brand-blue)", i: Smartphone },
            { l: "Store Credit", c: "var(--brand-orange)", i: Wallet },
          ].map((a) => {
            const Icon = a.i;
            return (
              <button
                key={a.l}
                className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white active:scale-[0.98]"
                style={{ backgroundColor: a.c }}
              >
                <Icon className="h-6 w-6" />
                {a.l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
