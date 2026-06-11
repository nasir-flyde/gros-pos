import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CUSTOMERS, formatINR, type Customer } from "@/lib/pos-data";
import { useCart } from "@/lib/cart-context";
import { Search, UserPlus, Delete, ArrowRight, Edit3 } from "lucide-react";

export const Route = createFileRoute("/_pos/customers")({
  head: () => ({ meta: [{ title: "Customer Lookup — CHOTA BAZAAR POS" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [mobile, setMobile] = useState("");
  const [adding, setAdding] = useState(false);
  const { setCustomer } = useCart();
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!mobile) return CUSTOMERS;
    return CUSTOMERS.filter((c) => c.mobile.includes(mobile) || c.name.toLowerCase().includes(mobile.toLowerCase()));
  }, [mobile]);

  const press = (d: string) => setMobile((m) => (m.length < 10 ? m + d : m));
  const back = () => setMobile((m) => m.slice(0, -1));

  if (adding) return <AddCustomer onCancel={() => setAdding(false)} onSaved={(c) => { setCustomer(c); navigate({ to: "/new-order" }); }} />;

  const select = (c: Customer) => {
    setCustomer(c);
    navigate({ to: "/new-order" });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Keypad */}
      <section className="flex w-full max-w-md shrink-0 flex-col border-r-2 bg-card p-5 md:w-[420px]">
        <h1 className="text-2xl font-extrabold tracking-tight">Customer Lookup</h1>
        <p className="text-sm font-semibold text-muted-foreground">Enter mobile number to search</p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-blue)]/30 bg-[var(--surface)] px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile…"
            className="w-full bg-transparent text-2xl font-extrabold tabular-nums tracking-wider focus:outline-none"
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>{d}</Key>
          ))}
          <Key onClick={() => setMobile("")} variant="muted">Clear</Key>
          <Key onClick={() => press("0")}>0</Key>
          <Key onClick={back} variant="muted"><Delete className="h-5 w-5" /></Key>
        </div>

        <button
          onClick={() => setAdding(true)}
          className="mt-4 tap-target-lg flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-orange)] text-base font-extrabold text-white active:scale-[0.98]"
        >
          <UserPlus className="h-5 w-5" /> Add New Customer
        </button>
      </section>

      {/* Results */}
      <section className="flex-1 overflow-y-auto p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {mobile ? `${results.length} matches` : "Recent Customers"}
        </h2>
        <ul className="grid gap-3">
          {results.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => select(c)}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-[var(--brand-blue)] active:scale-[0.99]"
              >
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--brand-blue)] text-lg font-extrabold text-white">
                  {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-extrabold leading-tight">{c.name}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {c.mobile} · {c.area} {c.pincode}
                  </div>
                  <div className="mt-1 flex gap-3 text-xs font-bold">
                    <span className="rounded-md bg-[var(--secondary)] px-2 py-0.5">{c.orders} orders</span>
                    <span className="rounded-md bg-[var(--brand-green)]/15 px-2 py-0.5 text-[var(--brand-green)]">
                      {formatINR(c.spend)}
                    </span>
                    <span className="rounded-md bg-[var(--brand-yellow)]/30 px-2 py-0.5">
                      ⭐ {c.loyalty} pts
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tap-target grid place-items-center rounded-xl bg-[var(--secondary)] px-3">
                    <Edit3 className="h-4 w-4" />
                  </span>
                  <span className="tap-target grid place-items-center rounded-xl bg-[var(--brand-green)] px-3 text-white">
                    <ArrowRight className="h-5 w-5" strokeWidth={3} />
                  </span>
                </div>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded-2xl border-2 border-dashed bg-card p-10 text-center text-muted-foreground">
              No customer found for "{mobile}". <Link to="/customers" onClick={() => setAdding(true)} className="font-bold text-[var(--brand-blue)] underline">Add new</Link>.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Key({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant?: "muted" }) {
  return (
    <button
      onClick={onClick}
      className={
        "tap-target-lg grid place-items-center rounded-2xl text-2xl font-extrabold active:scale-95 " +
        (variant === "muted"
          ? "bg-[var(--secondary)] text-foreground"
          : "bg-[var(--brand-blue)] text-white")
      }
    >
      {children}
    </button>
  );
}

function AddCustomer({ onCancel, onSaved }: { onCancel: () => void; onSaved: (c: Customer) => void }) {
  const [form, setForm] = useState({ name: "", mobile: "", address: "", area: "", pincode: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!form.name || form.mobile.length !== 10) return;
    onSaved({
      id: "c-new", name: form.name, mobile: form.mobile, area: form.area || "—",
      pincode: form.pincode, address: form.address, orders: 0, spend: 0, loyalty: 0,
    });
  };
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="text-2xl font-extrabold">Add New Customer</h1>
      <p className="text-sm font-semibold text-muted-foreground">Quick capture for first-time shoppers</p>
      <div className="mt-5 grid gap-4">
        <Field label="Full Name *" value={form.name} onChange={set("name")} placeholder="e.g. Ramesh Kumar" />
        <Field label="Mobile Number *" value={form.mobile} onChange={set("mobile")} placeholder="10 digits" inputMode="numeric" />
        <Field label="Address" value={form.address} onChange={set("address")} placeholder="House no, street" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Area / Locality" value={form.area} onChange={set("area")} placeholder="e.g. Karol Bagh" />
          <Field label="Pincode" value={form.pincode} onChange={set("pincode")} placeholder="6 digits" inputMode="numeric" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button onClick={onCancel} className="tap-target-lg rounded-2xl bg-[var(--secondary)] text-base font-extrabold active:scale-[0.98]">Cancel</button>
        <button onClick={save} className="tap-target-lg rounded-2xl bg-[var(--brand-green)] text-base font-extrabold text-white active:scale-[0.98]">Save Customer</button>
      </div>
    </div>
  );
}
function Field(props: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; inputMode?: "text" | "numeric" }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold">{props.label}</div>
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        className="tap-target-lg w-full rounded-2xl border-2 bg-card px-4 text-lg font-bold placeholder:text-muted-foreground/60 focus:border-[var(--brand-blue)] focus:outline-none"
      />
    </label>
  );
}
