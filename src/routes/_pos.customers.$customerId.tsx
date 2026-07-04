import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { customerApi, type PosCustomer } from "@/lib/customer-api";
import { orderApi, type PosOrder } from "@/lib/order-api";
import { formatINR } from "@/lib/utils";
import { useCart, type PosCartCustomer } from "@/lib/cart-context";
import { ArrowLeft, ArrowRight, CalendarDays, Loader2, ReceiptIndianRupee, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_pos/customers/$customerId")({
  head: () => ({ meta: [{ title: "Customer Details — CHHOTA BAZAAR POS" }] }),
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const { setCustomer } = useCart();

  const customerQuery = useQuery({
    queryKey: ["pos-customer-detail", customerId],
    queryFn: () => customerApi.getById(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["pos-customer-orders", customerId],
    queryFn: async () => {
      const allOrders: PosOrder[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await orderApi.list({ customerId, page, limit: 100 });
        allOrders.push(...((response.data ?? []) as PosOrder[]));
        totalPages = response.meta?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);

      return allOrders;
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const customer = customerQuery.data?.data as PosCustomer | undefined;
  const orders = ordersQuery.data ?? [];
  const isLoading = customerQuery.isLoading || ordersQuery.isLoading;

  const selectCustomer = () => {
    if (!customer) return;
    const cartCustomer: PosCartCustomer = {
      _id: customer._id,
      name: customer.name,
      mobile: customer.mobile,
      area: customer.area,
    };
    setCustomer(cartCustomer);
    window.history.back();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl rounded-3xl border-2 bg-card p-8 text-center">
          <h1 className="text-2xl font-extrabold">Customer not found</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            The customer details could not be loaded.
          </p>
          <Link
            to="/customers"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-blue)] px-5 py-3 text-sm font-extrabold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-3xl border-2 bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                to="/customers"
                className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-blue)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Customers
              </Link>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{customer.name}</h1>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {customer.mobile} · {customer.area || "Area not added"}
                {customer.pincode ? ` · ${customer.pincode}` : ""}
              </p>
            </div>

            <button
              onClick={selectCustomer}
              className="tap-target-lg inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-green)] px-5 text-sm font-extrabold text-white active:scale-[0.98]"
            >
              Select Customer
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StatCard
              label="Number of Orders"
              value={String(customer.ordersCount)}
              icon={ShoppingBag}
              color="var(--brand-blue)"
            />
            <StatCard
              label="Total Rupees"
              value={formatINR(customer.totalSpend)}
              icon={ReceiptIndianRupee}
              color="var(--brand-green)"
            />
            <StatCard
              label="Joining Date"
              value={new Date(customer.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              icon={CalendarDays}
              color="var(--brand-orange)"
            />
          </div>
        </div>

        <div className="rounded-3xl border-2 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b bg-[var(--secondary)] px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold">All Orders</h2>
              <p className="text-xs font-semibold text-muted-foreground">
                Complete order history for this customer
              </p>
            </div>
            <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
              {orders.length} loaded
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-muted-foreground">
              No orders found for this customer yet.
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold">{order.orderNumber}</div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("en-IN")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-1">{order.status}</span>
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-1">
                        {order.paymentMode || "—"}
                      </span>
                      <span className="rounded-md bg-[var(--secondary)] px-2 py-1">
                        {order.deliveryType}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground md:text-right">
                    <div>{order.items?.length ?? 0} items</div>
                    <div>{order.fulfillmentStatus || "No fulfillment status"}</div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-lg font-extrabold tabular-nums">
                      {formatINR(order.grandTotal)}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">
                      {order.paymentStatus || "Payment status unavailable"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof ShoppingBag;
  color: string;
}) {
  return (
    <div className="rounded-2xl border bg-[var(--secondary)]/35 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-3 text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
