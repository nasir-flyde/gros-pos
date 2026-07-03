import { Loader2, Printer } from "lucide-react";
import type { OrderTracking, PosOrder } from "@/lib/order-api";

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function FulfillmentOrderSection({
  title,
  orders,
  isLoading,
  onSelect,
  onPickupConfirm,
  onPrintReceipt,
  pickupPending = false,
  printPendingOrderId,
}: {
  title: string;
  orders: PosOrder[];
  isLoading: boolean;
  onSelect: (orderId: string) => void;
  onPickupConfirm?: (orderId: string) => void;
  onPrintReceipt?: (order: PosOrder) => void;
  pickupPending?: boolean;
  printPendingOrderId?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 bg-card">
      <div className="bg-[var(--secondary)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <table className="w-full">
        <thead className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Order</th>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td>
            </tr>
          ) : orders.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                No matching orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order._id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-extrabold tabular-nums">{order.orderNumber}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("en-IN")}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold">{order.customerId?.name || "Walk-in"}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {order.storeId?.storeName || "Current store"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold">{order.status}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {order.fulfillmentStatus || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                  {inr(order.grandTotal)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onSelect(order._id)}
                      className="rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-xs font-extrabold text-white"
                    >
                      View Tracking
                    </button>
                    {onPrintReceipt ? (
                      <button
                        onClick={() => onPrintReceipt(order)}
                        disabled={printPendingOrderId === order._id}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-orange)] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {printPendingOrderId === order._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        Print Receipt
                      </button>
                    ) : null}
                    {onPickupConfirm &&
                    order.deliveryType === "PICKUP" &&
                    order.status !== "COMPLETED" ? (
                      <button
                        onClick={() => onPickupConfirm(order._id)}
                        disabled={pickupPending}
                        className="rounded-lg bg-[var(--brand-green)] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        Pickup Confirm
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function FulfillmentTrackingPanel({
  selectedOrderId,
  tracking,
  isLoading,
}: {
  selectedOrderId: string | null;
  tracking?: OrderTracking;
  isLoading: boolean;
}) {
  return (
    <aside className="rounded-2xl border-2 bg-[var(--secondary)] p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Tracking Detail
      </div>
      {!selectedOrderId ? (
        <div className="mt-3 rounded-xl bg-white p-4 text-sm font-semibold text-muted-foreground">
          Select an order to view live fulfillment tracking.
        </div>
      ) : isLoading ? (
        <div className="mt-3 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : tracking ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-white p-4">
            <div className="font-extrabold">{tracking.orderId}</div>
            <div className="text-sm font-semibold text-muted-foreground">
              {tracking.status} · {tracking.fulfillmentStatus || "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm font-semibold">
            ETA:{" "}
            {tracking.estimatedDeliveryAt
              ? new Date(tracking.estimatedDeliveryAt).toLocaleString("en-IN")
              : "—"}
          </div>
          <div className="rounded-xl bg-white p-4 text-sm font-semibold">
            Delivery status: {tracking.deliveryOrderStatus || "Not yet dispatched"}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
