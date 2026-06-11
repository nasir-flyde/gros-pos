import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CATEGORIES, PRODUCTS, formatINR, type Product } from "@/lib/pos-data";
import { useCart } from "@/lib/cart-context";
import { Search, ScanLine, Mic, Plus, Minus, Trash2, Pause, X, ArrowRight, Bike } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_pos/new-order")({
  head: () => ({
    meta: [
      { title: "New Order — CHOTA BAZAAR POS" },
      { name: "description", content: "Fast grocery billing — search, scan, and check out in under 30 seconds." },
    ],
  }),
  component: NewOrderPage,
});

function NewOrderPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = PRODUCTS;
    if (cat) list = list.filter((p) => p.category === cat);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.barcode.includes(q),
      );
    }
    return list;
  }, [query, cat]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Product discovery */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Search row */}
        <div className="border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-[var(--brand-blue)]/20 bg-[var(--surface)] px-4 focus-within:border-[var(--brand-blue)]">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product, brand or scan barcode…"
                className="tap-target w-full bg-transparent text-base font-semibold placeholder:text-muted-foreground/70 focus:outline-none"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <Link
              to="/scanner"
              className="tap-target flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-4 font-bold text-white shadow-sm active:scale-[0.97]"
            >
              <ScanLine className="h-5 w-5" /> <span className="hidden sm:inline">Scan</span>
            </Link>
            <button className="tap-target grid place-items-center rounded-xl bg-[var(--secondary)] px-4 font-bold text-foreground active:scale-[0.97]">
              <Mic className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="overflow-x-auto border-b bg-card px-4 py-3">
          <div className="flex gap-2">
            <CategoryTile
              active={cat === null}
              onClick={() => setCat(null)}
              emoji="🛒"
              name="All Items"
              color="#052B7B"
            />
            {CATEGORIES.map((c) => (
              <CategoryTile
                key={c.id}
                active={cat === c.id}
                onClick={() => setCat(c.id)}
                emoji={c.emoji}
                name={c.name}
                color={c.color}
              />
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="text-center">
                <div className="text-5xl">🔍</div>
                <div className="mt-2 font-semibold">No products match "{query}"</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: Live cart */}
      <CartPanel />
    </div>
  );
}

function CategoryTile({
  emoji, name, color, active, onClick,
}: { emoji: string; name: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "tap-target-lg shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-bold transition-all " +
        (active
          ? "text-white shadow-md"
          : "bg-[var(--secondary)] text-foreground hover:bg-[var(--secondary)]/80")
      }
      style={active ? { backgroundColor: color } : undefined}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-[11px] leading-tight">{name}</span>
    </button>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { add, items } = useCart();
  const inCart = items.find((i) => i.product.id === product.id);
  const off = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  const lowStock = product.stock < 15;

  return (
    <button
      onClick={() => add(product)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card p-3 text-left shadow-sm transition-all active:scale-[0.98] active:border-[var(--brand-blue)]"
    >
      {off > 0 && (
        <span className="absolute left-2 top-2 z-10 rounded-md bg-[var(--brand-red)] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
          {off}% OFF
        </span>
      )}
      {inCart && (
        <span className="absolute right-2 top-2 z-10 grid h-7 min-w-7 place-items-center rounded-full bg-[var(--brand-green)] px-1.5 text-xs font-extrabold text-white">
          {inCart.qty}
        </span>
      )}
      <div className="grid aspect-square w-full place-items-center rounded-xl bg-[var(--secondary)] text-6xl">
        {product.emoji}
      </div>
      <div className="mt-2 flex-1">
        <div className="line-clamp-2 text-sm font-bold leading-tight">{product.name}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{product.weight}</div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-extrabold tabular-nums leading-none">{formatINR(product.price)}</div>
          {off > 0 && (
            <div className="text-[11px] font-semibold text-muted-foreground line-through tabular-nums">
              {formatINR(product.mrp)}
            </div>
          )}
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-blue)] text-white shadow-sm">
          <Plus className="h-5 w-5" strokeWidth={3} />
        </div>
      </div>
      {lowStock && (
        <div className="mt-1.5 text-[10px] font-bold uppercase text-[var(--brand-orange)]">
          Only {product.stock} left
        </div>
      )}
    </button>
  );
}

export function CartPanel() {
  const { items, inc, dec, remove, subtotal, discount, delivery, tax, total, count, clear, customer } = useCart();
  const navigate = useNavigate();

  return (
    <aside className="flex w-full max-w-[420px] shrink-0 flex-col overflow-hidden border-l-2 bg-card lg:w-[38%]">
      <div className="flex items-center justify-between border-b bg-[var(--brand-blue)] px-4 py-3 text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Current Cart</div>
          <div className="text-lg font-extrabold leading-tight">
            {count} {count === 1 ? "item" : "items"}
          </div>
        </div>
        <Link
          to="/customers"
          className="tap-target rounded-xl bg-white/15 px-3 text-sm font-bold text-white active:scale-[0.97]"
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
              <li key={i.product.id} className="flex items-start gap-3 px-4 py-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--secondary)] text-2xl">
                  {i.product.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold leading-tight">{i.product.name}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    {i.product.weight} · {formatINR(i.product.price)}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => dec(i.product.id)}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--secondary)] active:scale-95"
                    >
                      <Minus className="h-4 w-4" strokeWidth={3} />
                    </button>
                    <span className="min-w-[2.5rem] text-center text-base font-extrabold tabular-nums">
                      {i.qty}
                    </span>
                    <button
                      onClick={() => inc(i.product.id)}
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
                    onClick={() => remove(i.product.id)}
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

      {/* Summary */}
      <div className="border-t bg-[var(--surface)] px-4 py-3 text-sm">
        <Row label="Subtotal (MRP)" value={formatINR(subtotal)} />
        <Row label="Discount" value={"– " + formatINR(discount)} positive />
        <Row label="Delivery" value={delivery === 0 ? "FREE" : formatINR(delivery)} />
        <Row label="GST (5%)" value={formatINR(tax)} />
        <div className="mt-2 flex items-baseline justify-between border-t pt-2">
          <div className="text-sm font-bold uppercase tracking-wide">Grand Total</div>
          <div className="text-2xl font-extrabold tabular-nums">{formatINR(total)}</div>
        </div>
      </div>

      {/* Sticky action bar */}
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
          className="tap-target-lg grid place-items-center rounded-xl bg-[var(--brand-orange)] px-3 font-bold text-white disabled:opacity-40 active:scale-[0.97]"
          aria-label="Hold order"
        >
          <Pause className="h-5 w-5" />
        </button>
        <button
          disabled={items.length === 0}
          onClick={() => navigate({ to: "/checkout" })}
          className="tap-target-lg flex min-h-[80px] items-center justify-center gap-3 rounded-xl bg-[var(--brand-green)] text-lg font-extrabold text-white shadow-md disabled:opacity-40 active:scale-[0.98]"
        >
          <span>Checkout · {formatINR(total)}</span>
          <ArrowRight className="h-6 w-6" strokeWidth={3} />
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className={"font-bold tabular-nums " + (positive ? "text-[var(--brand-green)]" : "")}>{value}</span>
    </div>
  );
}
