import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, formatINR } from "@/lib/pos-data";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Minus,
  Trash2,
  Truck,
  Save,
  FileText,
  CheckCircle2,
  Send,
  Package,
  Scale,
  Box,
} from "lucide-react";

export const Route = createFileRoute("/_pos/transfer-stock")({
  head: () => ({ meta: [{ title: "Transfer Stock — CHHOTA BAZAAR" }] }),
  component: TransferStockPage,
});

const STORES = [
  { id: "ST-018", name: "CB Sector 56", area: "Gurgaon" },
  { id: "ST-022", name: "CB Sector 46", area: "Gurgaon" },
  { id: "ST-007", name: "CB Karol Bagh", area: "Delhi" },
  { id: "ST-031", name: "CB Lajpat Nagar", area: "Delhi" },
  { id: "ST-044", name: "CB Saket", area: "Delhi" },
];

const REASONS = [
  "Low Stock",
  "Emergency Refill",
  "Inventory Balancing",
  "Promotion Support",
  "Seasonal Demand",
];

type CartItem = { id: string; qty: number };

function TransferStockPage() {
  const [source, setSource] = useState("ST-018");
  const [dest, setDest] = useState("ST-022");
  const [reason, setReason] = useState("Inventory Balancing");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([
    { id: "p7", qty: 24 },
    { id: "p12", qty: 12 },
    { id: "p19", qty: 30 },
  ]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return PRODUCTS.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)),
    );
  }, [query, cat]);

  const cartDetailed = cart.map((c) => {
    const p = PRODUCTS.find((x) => x.id === c.id)!;
    return { ...c, product: p, value: c.qty * p.price };
  });

  const totalUnits = cartDetailed.reduce((s, x) => s + x.qty, 0);
  const totalValue = cartDetailed.reduce((s, x) => s + x.value, 0);
  const totalWeight = totalUnits * 0.48;
  const totalVolume = totalUnits * 0.0012;

  const addToCart = (id: string, n: number = 1) => {
    setCart((c) => {
      const ex = c.find((x) => x.id === id);
      if (ex) return c.map((x) => (x.id === id ? { ...x, qty: x.qty + n } : x));
      return [...c, { id, qty: n }];
    });
  };
  const setQty = (id: string, q: number) =>
    setCart((c) =>
      q <= 0 ? c.filter((x) => x.id !== id) : c.map((x) => (x.id === id ? { ...x, qty: q } : x)),
    );

  const cats = [
    { id: "all", name: "All", emoji: "🛒" },
    ...Array.from(new Set(PRODUCTS.map((p) => p.category))).map((c) => ({
      id: c,
      name: c,
      emoji: PRODUCTS.find((p) => p.category === c)?.emoji ?? "📦",
    })),
  ];

  const srcStore = STORES.find((s) => s.id === source)!;
  const destStore = STORES.find((s) => s.id === dest)!;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b-2 bg-[var(--surface)] px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/inventory"
            className="tap-target grid place-items-center rounded-xl border-2 bg-white px-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold leading-tight">Transfer Stock</h1>
            <div className="text-xs font-semibold text-muted-foreground">
              TRN-2026-00942 · Draft · Created by Rajesh K. ·{" "}
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </div>
          </div>
          <span className="rounded-xl bg-[var(--brand-yellow)] px-3 py-1.5 text-xs font-extrabold uppercase text-[var(--brand-blue)]">
            Draft
          </span>
        </div>

        {/* Source / Dest / Reason */}
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_2fr]">
          <StoreSelect
            label="Source Store"
            value={source}
            onChange={setSource}
            accent="var(--brand-blue)"
          />
          <div className="grid place-items-center">
            <ArrowRight className="h-7 w-7 text-[var(--brand-orange)]" />
          </div>
          <StoreSelect
            label="Destination Store"
            value={dest}
            onChange={setDest}
            accent="var(--brand-orange)"
          />
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Transfer Reason
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className="h-12 rounded-xl px-3 text-xs font-extrabold transition-colors"
                  style={{
                    backgroundColor: reason === r ? "var(--brand-blue)" : "var(--secondary)",
                    color: reason === r ? "#fff" : "var(--ink)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_400px] overflow-hidden">
        {/* Available stock */}
        <div className="flex flex-col overflow-hidden border-r-2">
          <div className="border-b bg-[var(--surface)] p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search product, brand, barcode…"
                  className="tap-target w-full rounded-xl border-2 bg-white pl-11 pr-3 text-base font-semibold outline-none focus:border-[var(--brand-blue)]"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold capitalize"
                  style={{
                    backgroundColor: cat === c.id ? "var(--brand-blue)" : "var(--secondary)",
                    color: cat === c.id ? "#fff" : "var(--ink)",
                  }}
                >
                  <span className="text-base">{c.emoji}</span> {c.name.replace("-", " & ")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {srcStore.name} · Available Stock · {filtered.length} SKUs
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const reserved = Math.min(p.stock, Math.floor(p.stock * 0.15));
                const transferable = p.stock - reserved;
                return (
                  <div key={p.id} className="rounded-2xl border-2 bg-white p-2.5">
                    <div className="flex gap-2">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-2xl">
                        {p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold leading-tight">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          {p.weight} · {formatINR(p.price)}
                        </div>
                        <div className="mt-1 flex gap-2 text-[10px] font-bold">
                          <span className="rounded-md bg-[var(--brand-green)]/15 px-1.5 py-0.5 text-[var(--brand-green)]">
                            AVL {p.stock}
                          </span>
                          <span className="rounded-md bg-[var(--brand-orange)]/15 px-1.5 py-0.5 text-[var(--brand-orange)]">
                            RSV {reserved}
                          </span>
                          <span className="rounded-md bg-[var(--brand-blue)]/15 px-1.5 py-0.5 text-[var(--brand-blue)]">
                            TRN {transferable}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 5, 10, 25].map((n) => (
                        <button
                          key={n}
                          onClick={() => addToCart(p.id, n)}
                          className="h-11 flex-1 rounded-lg bg-[var(--secondary)] text-xs font-extrabold active:bg-[var(--brand-blue)] active:text-white"
                        >
                          +{n}
                        </button>
                      ))}
                      <button
                        onClick={() => addToCart(p.id, 1)}
                        className="h-11 rounded-lg bg-[var(--brand-blue)] px-3 text-xs font-extrabold text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cart */}
        <aside className="flex flex-col overflow-hidden bg-[var(--surface)]">
          <div className="border-b bg-[var(--brand-blue)] px-4 py-3 text-white">
            <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">
              Transfer Cart
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-extrabold">{cart.length} products</div>
              <div className="text-2xl font-extrabold tabular-nums">{formatINR(totalValue)}</div>
            </div>
            <div className="mt-1 text-xs font-semibold opacity-80">
              → {destStore.name} · {destStore.area}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {cartDetailed.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
                Tap products to add to transfer
              </div>
            )}
            {cartDetailed.map((c) => (
              <div key={c.id} className="mb-2 rounded-2xl border-2 bg-white p-2.5">
                <div className="flex gap-2">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-2xl">
                    {c.product.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold">{c.product.name}</div>
                    <div className="text-[11px] font-semibold text-muted-foreground">
                      {formatINR(c.value)} · {c.product.weight}
                    </div>
                  </div>
                  <button
                    onClick={() => setQty(c.id, 0)}
                    className="grid h-10 w-10 place-items-center rounded-lg text-[var(--brand-red)] active:bg-[var(--brand-red)]/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => setQty(c.id, c.qty - 1)}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--secondary)]"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="w-16 text-center text-2xl font-extrabold tabular-nums">
                    {c.qty}
                  </div>
                  <button
                    onClick={() => setQty(c.id, c.qty + 1)}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-blue)] text-white"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <SumStat icon={Package} label="Products" value={String(cartDetailed.length)} />
              <SumStat icon={Box} label="Units" value={String(totalUnits)} />
              <SumStat icon={Scale} label="Weight" value={`${totalWeight.toFixed(1)} kg`} />
              <SumStat icon={Truck} label="Volume" value={`${totalVolume.toFixed(3)} m³`} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[var(--secondary)] p-2 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">
                  Expected Arrival
                </div>
                <div className="font-extrabold">Today · 6:30 PM</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">
                  Vehicle Type
                </div>
                <div className="font-extrabold">Tata Ace · 1T</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky bottom */}
      <div className="flex items-center justify-end gap-2 border-t-2 bg-[var(--surface)] px-5 py-3 shadow-[0_-4px_0_var(--color-border)]">
        <button className="tap-target-lg rounded-2xl border-2 bg-white px-5 text-sm font-extrabold">
          <Save className="mr-2 inline h-5 w-5" /> Save Draft
        </button>
        <button className="tap-target-lg rounded-2xl border-2 border-[var(--brand-blue)] bg-white px-5 text-sm font-extrabold text-[var(--brand-blue)]">
          <FileText className="mr-2 inline h-5 w-5" /> Generate Transfer Note
        </button>
        <button className="tap-target-lg rounded-2xl bg-[var(--brand-orange)] px-5 text-sm font-extrabold text-white shadow-[0_4px_0_#B85800]">
          <CheckCircle2 className="mr-2 inline h-5 w-5" /> Approve Transfer
        </button>
        <button className="tap-target-lg rounded-2xl bg-[var(--brand-green)] px-6 text-base font-extrabold text-white shadow-[0_4px_0_#3D7A28]">
          <Send className="mr-2 inline h-5 w-5" /> Dispatch Transfer
        </button>
      </div>
    </div>
  );
}

function StoreSelect({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-1 flex items-center gap-2 rounded-xl border-2 bg-white p-2"
        style={{ borderColor: accent }}
      >
        <div
          className="grid h-12 w-12 place-items-center rounded-lg text-white"
          style={{ backgroundColor: accent }}
        >
          <Truck className="h-6 w-6" />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-base font-extrabold outline-none"
        >
          {STORES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.area}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SumStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border-2 p-2">
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-base font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
