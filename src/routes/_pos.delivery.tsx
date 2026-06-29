import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_QUEUE, RIDERS, formatINR } from "@/lib/pos-data";
import { MapPin, Clock, Bike } from "lucide-react";

export const Route = createFileRoute("/_pos/delivery")({
  validateSearch: (search: Record<string, string>) => ({
    orderId: search.orderId || "",
  }),
  head: () => ({ meta: [{ title: "Delivery Assignment — CHHOTA BAZAAR POS" }] }),
  component: DeliveryPage,
});

function DeliveryPage() {
  return (
    <div className="grid h-full overflow-hidden lg:grid-cols-[1fr_380px]">
      {/* Order queue */}
      <section className="flex flex-col overflow-hidden">
        <div className="border-b bg-card px-5 py-3">
          <h1 className="text-2xl font-extrabold">Delivery Queue</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            {DELIVERY_QUEUE.filter((d) => d.status === "unassigned").length} unassigned ·{" "}
            {DELIVERY_QUEUE.filter((d) => d.status === "assigned").length} assigned
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="overflow-hidden rounded-2xl border-2 bg-card">
            <table className="w-full">
              <thead className="bg-[var(--secondary)] text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Area</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">ETA</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {DELIVERY_QUEUE.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-extrabold tabular-nums">{d.id}</div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {d.customer}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold">
                        <MapPin className="h-4 w-4 text-[var(--brand-red)]" /> {d.area}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                      {formatINR(d.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm font-bold">
                        <Clock className="h-4 w-4" /> {d.eta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.status === "unassigned" ? (
                        <button className="tap-target rounded-xl bg-[var(--brand-blue)] px-4 font-extrabold text-white active:scale-95">
                          Assign
                        </button>
                      ) : (
                        <span className="rounded-md bg-[var(--brand-green)]/15 px-3 py-1.5 text-xs font-bold text-[var(--brand-green)]">
                          Sonu Yadav
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Riders */}
      <aside className="flex flex-col overflow-hidden border-t-2 bg-card lg:border-l-2 lg:border-t-0">
        <div className="border-b px-5 py-3">
          <h2 className="text-lg font-extrabold">Available Riders</h2>
          <p className="text-xs font-semibold text-muted-foreground">
            {RIDERS.filter((r) => r.available).length} of {RIDERS.length} online
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-2">
            {RIDERS.map((r) => (
              <li
                key={r.id}
                className={
                  "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border-2 p-3 " +
                  (r.available ? "bg-card" : "bg-[var(--secondary)] opacity-70")
                }
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-blue)] text-base font-extrabold text-white">
                  {r.initial}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold leading-tight">{r.name}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {r.active} active · {r.distance}
                  </div>
                  <div className="mt-1">
                    {r.available ? (
                      <span className="rounded-md bg-[var(--brand-green)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-green)]">
                        ● Available
                      </span>
                    ) : (
                      <span className="rounded-md bg-[var(--brand-orange)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-orange)]">
                        Busy
                      </span>
                    )}
                  </div>
                </div>
                <button
                  disabled={!r.available}
                  className="tap-target grid place-items-center rounded-xl bg-[var(--brand-blue)] px-3 text-white disabled:opacity-40 active:scale-95"
                  aria-label="Assign rider"
                >
                  <Bike className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
