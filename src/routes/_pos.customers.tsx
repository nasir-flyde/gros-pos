import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi, type PosCustomer } from "@/lib/customer-api";
import { formatINR } from "@/lib/utils";
import { useCart, type PosCartCustomer } from "@/lib/cart-context";
import { Search, UserPlus, Delete, ArrowRight, Edit3, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_pos/customers")({
  head: () => ({ meta: [{ title: "Customer Lookup — CHOTA BAZAAR POS" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [mobile, setMobile] = useState("");
  const [adding, setAdding] = useState(false);
  const { setCustomer } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: searchRes, isFetching } = useQuery({
    queryKey: ["pos-customers", mobile],
    queryFn: () => customerApi.search(mobile || undefined),
    enabled: true,
    staleTime: 30_000,
  });

  const results: PosCustomer[] = searchRes?.data ?? [];

  const press = (d: string) => setMobile((m) => (m.length < 10 ? m + d : m));
  const back = () => setMobile((m) => m.slice(0, -1));

  const goBack = () => window.history.back();

  if (adding)
    return (
      <AddCustomer
        onCancel={() => setAdding(false)}
        onSaved={(c) => {
          setCustomer(c);
          goBack();
        }}
      />
    );

  const select = (c: PosCustomer) => {
    const cartCustomer: PosCartCustomer = {
      _id: c._id,
      name: c.name,
      mobile: c.mobile,
      area: c.area,
    };
    setCustomer(cartCustomer);
    goBack();
  };

  return (
    <div className="flex h-full overflow-hidden">
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
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={() => setMobile("")} variant="muted">
            Clear
          </Key>
          <Key onClick={() => press("0")}>0</Key>
          <Key onClick={back} variant="muted">
            <Delete className="h-5 w-5" />
          </Key>
        </div>

        <button
          onClick={() => setAdding(true)}
          className="mt-4 tap-target-lg flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-orange)] text-base font-extrabold text-white active:scale-[0.98]"
        >
          <UserPlus className="h-5 w-5" /> Add New Customer
        </button>
      </section>

      <section className="flex-1 overflow-y-auto p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {mobile ? `${results.length} matches` : "Recent Customers"}
        </h2>
        {isFetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="grid gap-3">
            {results.map((c) => (
              <li key={c._id}>
                <button
                  onClick={() => select(c)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-[var(--brand-blue)] active:scale-[0.99]"
                >
                  <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--brand-blue)] text-lg font-extrabold text-white">
                    {c.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-extrabold leading-tight">{c.name}</div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {c.mobile} · {c.area || "—"} {c.pincode || ""}
                    </div>
                    <div className="mt-1 flex gap-3 text-xs font-bold">
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-0.5">
                        {c.ordersCount} orders
                      </span>
                      <span className="rounded-md bg-[var(--brand-green)]/15 px-2 py-0.5 text-[var(--brand-green)]">
                        {formatINR(c.totalSpend)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tap-target grid place-items-center rounded-xl bg-[var(--brand-green)] px-3 text-white">
                      <ArrowRight className="h-5 w-5" strokeWidth={3} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
            {results.length === 0 && !isFetching && (
              <li className="rounded-2xl border-2 border-dashed bg-card p-10 text-center text-muted-foreground">
                No customer found{mobile ? ` for "${mobile}"` : ""}.{" "}
                <button
                  onClick={() => setAdding(true)}
                  className="font-bold text-[var(--brand-blue)] underline"
                >
                  Add new
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function Key({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "muted";
}) {
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

function AddCustomer({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (c: PosCartCustomer) => void;
}) {
  const [form, setForm] = useState({ name: "", mobile: "", address: "", area: "", pincode: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; mobile: string; area?: string; pincode?: string }) =>
      customerApi.create(data),
    onSuccess: (res) => {
      const c = res.data;
      onSaved({
        _id: c._id,
        name: c.name,
        mobile: c.mobile,
        area: c.area,
      });
    },
  });

  const save = () => {
    if (!form.name || form.mobile.length !== 10) return;
    createMutation.mutate({
      name: form.name,
      mobile: form.mobile,
      area: form.area || undefined,
      pincode: form.pincode || undefined,
    });
  };

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6">
      <h1 className="text-2xl font-extrabold">Add New Customer</h1>
      <p className="text-sm font-semibold text-muted-foreground">
        Quick capture for first-time shoppers
      </p>
      <div className="mt-5 grid gap-4">
        <Field
          label="Full Name *"
          value={form.name}
          onChange={set("name")}
          placeholder="e.g. Ramesh Kumar"
        />
        <Field
          label="Mobile Number *"
          value={form.mobile}
          onChange={set("mobile")}
          placeholder="10 digits"
          inputMode="numeric"
        />
        <Field
          label="Address"
          value={form.address}
          onChange={set("address")}
          placeholder="House no, street"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Area / Locality"
            value={form.area}
            onChange={set("area")}
            placeholder="e.g. Karol Bagh"
          />
          <Field
            label="Pincode"
            value={form.pincode}
            onChange={set("pincode")}
            placeholder="6 digits"
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          className="tap-target-lg rounded-2xl bg-[var(--secondary)] text-base font-extrabold active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={createMutation.isPending}
          className="tap-target-lg flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-green)] text-base font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {createMutation.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
          Save Customer
        </button>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}) {
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
