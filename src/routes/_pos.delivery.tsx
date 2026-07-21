import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { orderApi, type OrderTracking, type PosOrder } from "@/lib/order-api";
import { fetchAndPrintOrderReceipt } from "@/lib/order-receipt";
import {
  FulfillmentOrderSection,
  FulfillmentTrackingPanel,
} from "@/components/fulfillment/order-section";
import { toast } from "sonner";

export const Route = createFileRoute("/_pos/delivery")({
  head: () => ({ meta: [{ title: "Delivery Queue" }] }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const queryClient = useQueryClient();
  const { scopes } = useAuthStore();
  const storeId = scopes.find((scope) => scope.type === "store")?.id ?? "";
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  const params = useMemo(() => {
    const next: Record<string, unknown> = {
      limit: 100,
    };
    if (storeId) next.storeId = storeId;
    if (query.trim()) next.search = query.trim();
    return next;
  }, [query, storeId]);

  const deliveryQuery = useQuery({
    queryKey: ["pos-delivery-orders", params],
    queryFn: () => orderApi.list(params),
    enabled: !!storeId,
  });
  const trackingQuery = useQuery({
    queryKey: ["order-tracking", selectedOrderId],
    queryFn: () => orderApi.getTracking(selectedOrderId!),
    enabled: !!selectedOrderId,
  });
  const pickupConfirmMutation = useMutation({
    mutationFn: (orderId: string) => orderApi.pickupConfirm(orderId),
    onSuccess: () => {
      toast.success("Pickup confirmed");
      queryClient.invalidateQueries({ queryKey: ["pos-delivery-orders"] });
      if (selectedOrderId) {
        queryClient.invalidateQueries({ queryKey: ["order-tracking", selectedOrderId] });
      }
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Failed to confirm pickup";
      toast.error(message);
    },
  });
  const printReceiptMutation = useMutation({
    mutationFn: async (order: PosOrder) => {
      setPrintingOrderId(order._id);
      return fetchAndPrintOrderReceipt(order);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Receipt could not be printed.";
      toast.error(message);
    },
    onSettled: () => {
      setPrintingOrderId(null);
    },
  });

  const orders = ((deliveryQuery.data?.data ?? []) as PosOrder[]).filter(
    (order) => order.deliveryType === "HOME" || order.deliveryType === "PICKUP",
  );
  const pickupOrders = orders.filter((order) => order.deliveryType === "PICKUP");
  const homeOrders = orders.filter((order) => order.deliveryType === "HOME");
  const tracking = trackingQuery.data?.data as OrderTracking | undefined;

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="rounded-2xl border-2 bg-card p-5">
        <h1 className="text-2xl font-extrabold">Store Fulfillment</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {pickupOrders.length} pickup · {homeOrders.length} home delivery
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-[var(--brand-blue)]/20 bg-white px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number"
            className="w-full bg-transparent text-base font-semibold focus:outline-none"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <OrderSection
              title="Pickup Ready / In Progress"
              orders={pickupOrders}
              isLoading={deliveryQuery.isLoading}
              onSelect={setSelectedOrderId}
              onPrintReceipt={(order) => printReceiptMutation.mutate(order)}
              onPickupConfirm={(orderId) => pickupConfirmMutation.mutate(orderId)}
              pickupPending={pickupConfirmMutation.isPending}
              printPendingOrderId={printingOrderId}
            />
            <OrderSection
              title="Home Delivery Tracking"
              orders={homeOrders}
              isLoading={deliveryQuery.isLoading}
              onSelect={setSelectedOrderId}
              onPrintReceipt={(order) => printReceiptMutation.mutate(order)}
              printPendingOrderId={printingOrderId}
            />
          </div>
          <FulfillmentTrackingPanel
            selectedOrderId={selectedOrderId}
            tracking={tracking}
            isLoading={trackingQuery.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

function OrderSection({
  title,
  orders,
  isLoading,
  onSelect,
  onPrintReceipt,
  onPickupConfirm,
  pickupPending = false,
  printPendingOrderId,
}: {
  title: string;
  orders: PosOrder[];
  isLoading: boolean;
  onSelect: (orderId: string) => void;
  onPrintReceipt?: (order: PosOrder) => void;
  onPickupConfirm?: (orderId: string) => void;
  pickupPending?: boolean;
  printPendingOrderId?: string | null;
}) {
  return (
    <FulfillmentOrderSection
      title={title}
      orders={orders}
      isLoading={isLoading}
      onSelect={onSelect}
      onPrintReceipt={onPrintReceipt}
      onPickupConfirm={onPickupConfirm}
      pickupPending={pickupPending}
      printPendingOrderId={printPendingOrderId}
    />
  );
}
