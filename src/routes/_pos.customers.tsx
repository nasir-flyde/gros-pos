import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  customerApi,
  getCustomerAddress,
  getCustomerMobile,
  getCustomerOrderCount,
  type PosCustomer,
} from "@/lib/customer-api";
import {
  isCustomerBlocked,
  validateCustomerForm,
  type CustomerFormErrors,
} from "@/lib/customer-flow";
import { getErrorMessage } from "@/lib/pos-page-state";
import { formatINR } from "@/lib/utils";
import { useCart, type PosCartCustomer } from "@/lib/cart-context";
import {
  Search,
  UserPlus,
  ArrowRight,
  Loader2,
  Eye,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  IndianRupee,
  X,
} from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_pos/customers")({
  validateSearch: z.object({
    returnTo: z.enum(["/new-order", "/checkout"]).optional(),
  }),
  head: () => ({ meta: [{ title: "Customer Lookup" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const { setCustomer } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const isCustomersIndex = pathname === "/customers";

  const customerSearchQuery = useQuery({
    queryKey: ["pos-customers", search.trim()],
    queryFn: () => customerApi.search(search.trim() || undefined),
    enabled: isCustomersIndex,
    staleTime: 30_000,
  });

  const results: PosCustomer[] = customerSearchQuery.data?.data ?? [];

  if (!isCustomersIndex) {
    return <Outlet />;
  }

  const returnToOrigin = () => {
    if (!returnTo) return;
    navigate({ to: returnTo });
  };

  if (adding)
    return (
      <AddCustomer
        onCancel={() => setAdding(false)}
        onSaved={(c) => {
          setCustomer(c);
          returnToOrigin();
        }}
      />
    );

  const select = (c: PosCustomer) => {
    if (isCustomerBlocked(c.status)) return;
    const cartCustomer: PosCartCustomer = {
      _id: c._id,
      name: c.name,
      mobile: getCustomerMobile(c),
      area: c.area,
    };
    setCustomer(cartCustomer);
    returnToOrigin();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--surface)]">
      <header className="border-b-2 bg-card px-5 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Select Customer</h1>
            <p className="text-sm font-semibold text-muted-foreground">
              Search by customer name or mobile number
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-4 text-sm font-extrabold text-white active:scale-[0.98]"
          >
            <UserPlus className="h-5 w-5" /> Add New Customer
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--brand-blue)]" />
            <input
              aria-label="Search customers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or mobile number..."
              autoFocus
              className="h-14 w-full rounded-2xl border-2 border-[var(--brand-blue)]/30 bg-card pl-12 pr-12 text-base font-bold shadow-sm outline-none placeholder:font-semibold placeholder:text-muted-foreground/70 focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-[var(--brand-blue)]/10"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear customer search"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg bg-[var(--secondary)] text-muted-foreground active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mb-3 mt-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {search.trim() ? "Search Results" : "Recent Customers"}
            </h2>
            {!customerSearchQuery.isFetching && (
              <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-muted-foreground shadow-sm">
                {results.length} {results.length === 1 ? "customer" : "customers"}
              </span>
            )}
          </div>

          {customerSearchQuery.isFetching ? (
            <div className="flex items-center justify-center rounded-2xl border-2 border-dashed bg-card py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--brand-blue)]" />
            </div>
          ) : customerSearchQuery.isError ? (
            <div className="rounded-2xl border-2 border-[var(--brand-red)]/30 bg-card p-10 text-center text-muted-foreground">
              <Search className="mx-auto h-8 w-8 text-[var(--brand-red)]" />
              <p className="mt-3 font-bold text-foreground">Customer search unavailable</p>
              <p className="mt-1 text-sm font-semibold">
                {getErrorMessage(customerSearchQuery.error, "Unable to search customers.")}
              </p>
              <button
                type="button"
                onClick={() => void customerSearchQuery.refetch()}
                className="mt-4 rounded-xl bg-[var(--brand-blue)] px-5 py-3 text-sm font-extrabold text-white"
              >
                Retry Search
              </button>
            </div>
          ) : (
            <ul className="grid gap-4 xl:grid-cols-2">
              {results.map((customer) => (
                <li key={customer._id}>
                  <CustomerCard
                    customer={customer}
                    onSelect={() => select(customer)}
                    returnTo={returnTo}
                  />
                </li>
              ))}
              {results.length === 0 && (
                <li className="rounded-2xl border-2 border-dashed bg-card p-10 text-center text-muted-foreground xl:col-span-2">
                  <Search className="mx-auto h-8 w-8 opacity-40" />
                  <p className="mt-3 font-bold text-foreground">No customer found</p>
                  <p className="mt-1 text-sm font-semibold">
                    {search.trim()
                      ? `No result for “${search.trim()}”. Try a name or mobile number.`
                      : "There are no customers to show yet."}
                  </p>
                  <button
                    onClick={() => setAdding(true)}
                    className="mt-4 font-extrabold text-[var(--brand-blue)] underline"
                  >
                    Add a new customer
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function CustomerCard({
  customer,
  onSelect,
  returnTo,
}: {
  customer: PosCustomer;
  onSelect: () => void;
  returnTo?: "/new-order" | "/checkout";
}) {
  const mobile = getCustomerMobile(customer);
  const address = getCustomerAddress(customer);
  const orderCount = getCustomerOrderCount(customer);
  const totalSpend = customer.totalSpend ?? 0;
  const isBlocked = isCustomerBlocked(customer.status);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm">
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--brand-blue)] text-lg font-extrabold uppercase text-white shadow-sm">
          {customer.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-extrabold leading-tight">{customer.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                isBlocked
                  ? "bg-[var(--brand-red)]/10 text-[var(--brand-red)]"
                  : "bg-[var(--brand-green)]/10 text-[var(--brand-green)]"
              }`}
            >
              {customer.status || "Active"}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <CustomerDetail icon={Phone} label="Mobile" value={mobile || "Not provided"} />
            <CustomerDetail icon={Mail} label="Email" value={customer.email || "Not provided"} />
            <CustomerDetail
              icon={MapPin}
              label="Address"
              value={address || "Address not provided"}
              className="sm:col-span-2"
            />
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-y bg-border">
        <CustomerStat icon={ShoppingBag} label="Total Orders" value={String(orderCount)} />
        <CustomerStat icon={IndianRupee} label="Total Spend" value={formatINR(totalSpend)} />
      </div>

      <div className="mt-auto flex gap-2 bg-[var(--secondary)]/35 p-3">
        <button
          onClick={onSelect}
          disabled={isBlocked}
          className="tap-target flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-green)] px-3 text-sm font-extrabold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBlocked ? "Customer Blocked" : "Select Customer"}
          <ArrowRight className="h-4 w-4" strokeWidth={3} />
        </button>
        <Link
          to="/customers/$customerId"
          params={{ customerId: customer._id }}
          search={returnTo ? { returnTo } : {}}
          className="tap-target inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-extrabold text-foreground active:scale-[0.99]"
        >
          <Eye className="h-4 w-4" />
          View
        </Link>
      </div>
    </article>
  );
}

function CustomerDetail({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="break-words font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function CustomerStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--secondary)]">
        <Icon className="h-4 w-4 text-[var(--brand-blue)]" />
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="font-extrabold tabular-nums">{value}</div>
      </div>
    </div>
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
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const createMutation = useMutation({
    mutationFn: customerApi.create,
    onSuccess: (res) => {
      const c = res.data;
      onSaved({
        _id: c._id,
        name: c.name,
        mobile: getCustomerMobile(c),
        area: c.area,
      });
    },
  });

  const save = () => {
    const result = validateCustomerForm(form);
    setFormErrors(result.errors);
    if (!result.payload) return;
    createMutation.mutate(result.payload);
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
          error={formErrors.name}
        />
        <Field
          label="Mobile Number *"
          value={form.mobile}
          onChange={set("mobile")}
          placeholder="10 digits"
          inputMode="numeric"
          error={formErrors.mobile}
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
            error={formErrors.area}
          />
          <Field
            label="Pincode"
            value={form.pincode}
            onChange={set("pincode")}
            placeholder="6 digits"
            inputMode="numeric"
            error={formErrors.pincode}
          />
        </div>
      </div>
      {createMutation.isError ? (
        <div className="mt-4 rounded-xl border border-[var(--brand-red)]/30 bg-[var(--brand-red)]/5 px-4 py-3 text-sm font-semibold text-[var(--brand-red)]">
          {getErrorMessage(createMutation.error, "Customer could not be created.")}
        </div>
      ) : null}
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
  error?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold">{props.label}</div>
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        aria-invalid={Boolean(props.error)}
        className={
          "tap-target-lg w-full rounded-2xl border-2 bg-card px-4 text-lg font-bold placeholder:text-muted-foreground/60 focus:border-[var(--brand-blue)] focus:outline-none " +
          (props.error ? "border-[var(--brand-red)]" : "")
        }
      />
      {props.error ? (
        <div className="mt-1 text-sm font-semibold text-[var(--brand-red)]">{props.error}</div>
      ) : null}
    </label>
  );
}
