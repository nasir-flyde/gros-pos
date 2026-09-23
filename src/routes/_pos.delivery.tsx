import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import {
  orderApi,
  type DeliveryAgentRef,
  type DeliveryAssignment,
  type PosOrder,
  type StoreDeliveryOrder,
} from "@/lib/order-api";
import { deliveryApi, type ManualDeliveryReason } from "@/lib/delivery-api";
import { fulfillmentApi } from "@/lib/fulfillment-api";
import { fetchAndPrintOrderReceipt } from "@/lib/order-receipt";
import {
  FulfillmentOrderSection,
  FulfillmentTrackingPanel,
} from "@/components/fulfillment/order-section";
import { getErrorMessage } from "@/lib/pos-page-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_pos/delivery")({
  head: () => ({ meta: [{ title: "Delivery Queue" }] }),
  component: DeliveryPage,
});

type HomeView = "PENDING_PACKING" | "READY" | "ASSIGNED" | "IN_TRANSIT" | "HISTORY";
type AssignmentMode = "IN_HOUSE" | "THIRD_PARTY";
type ManualAction = "PICKUP" | "DELIVER";

const HOME_VIEWS: Array<{ value: HomeView; label: string }> = [
  { value: "PENDING_PACKING", label: "Pending Packing" },
  { value: "READY", label: "Ready to Assign" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "HISTORY", label: "History" },
];

const MANUAL_REASONS: Array<{ value: ManualDeliveryReason; label: string }> = [
  { value: "SCANNER_UNAVAILABLE", label: "Scanner unavailable" },
  { value: "CUSTOMER_CONFIRMED", label: "Customer confirmed" },
  { value: "THIRD_PARTY_CONFIRMED", label: "Third party confirmed" },
  { value: "OTHER", label: "Other" },
];

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-IN") : "Not recorded";

const formatAddress = (order: StoreDeliveryOrder) => {
  const address = order.deliveryAddressSnapshot;
  return [address?.line1, address?.line2, address?.landmark, address?.city, address?.pincode]
    .filter(Boolean)
    .join(", ");
};

const orderMatchesView = (order: StoreDeliveryOrder, view: HomeView) => {
  const status = order.deliveryAssignment?.status;
  if (view === "PENDING_PACKING") {
    return !status && !order.isDeliveryAssignable && order.fulfillmentStatus !== "CANCELLED";
  }
  if (view === "READY") return order.isDeliveryAssignable;
  if (view === "ASSIGNED") return status === "ASSIGNED";
  if (view === "IN_TRANSIT") return status === "PICKED_UP" || status === "OUT_FOR_DELIVERY";
  return status === "DELIVERED" || status === "FAILED" || status === "REATTEMPT_SCHEDULED";
};

export function DeliveryPage() {
  const queryClient = useQueryClient();
  const scopes = useAuthStore((state) => state.scopes);
  const permissions = useAuthStore((state) => state.permissions);
  const stores = useMemo(() => scopes.filter((scope) => scope.type === "store"), [scopes]);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [homeView, setHomeView] = useState<HomeView>("PENDING_PACKING");
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [assignmentOrder, setAssignmentOrder] = useState<StoreDeliveryOrder | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("IN_HOUSE");
  const [deliveryAgentId, setDeliveryAgentId] = useState("");
  const [provider, setProvider] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [manualState, setManualState] = useState<{
    order: StoreDeliveryOrder;
    action: ManualAction;
  } | null>(null);
  const [manualReason, setManualReason] = useState<ManualDeliveryReason>("SCANNER_UNAVAILABLE");
  const [manualNote, setManualNote] = useState("");
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!stores.some((store) => store.id === storeId)) setStoreId(stores[0]?.id ?? "");
  }, [storeId, stores]);

  const canAssign = permissions.includes("delivery.manifest.create");
  const canConfirm = permissions.includes("delivery.confirm");
  const canFulfill = permissions.includes("order.fulfill");
  const canViewAgents = permissions.includes("delivery.manifest.view");

  const homeQuery = useQuery({
    queryKey: ["pos-store-deliveries", storeId, search],
    queryFn: () =>
      orderApi.listStoreDeliveries({
        storeId,
        limit: 100,
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
  });

  const pickupQuery = useQuery({
    queryKey: ["pos-customer-pickups", storeId, search],
    queryFn: () =>
      orderApi.list({
        storeId,
        deliveryType: "PICKUP",
        limit: 100,
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
  });

  const homeOrders = useMemo(
    () => (homeQuery.data?.data ?? []) as StoreDeliveryOrder[],
    [homeQuery.data?.data],
  );
  const pickupOrders = useMemo(
    () =>
      ((pickupQuery.data?.data ?? []) as PosOrder[]).filter(
        (order) => order.deliveryType === "PICKUP",
      ),
    [pickupQuery.data?.data],
  );
  const displayedHomeOrders = useMemo(
    () => homeOrders.filter((order) => orderMatchesView(order, homeView)),
    [homeOrders, homeView],
  );
  const selectedHomeOrder = homeOrders.find((order) => order._id === selectedHomeId) ?? null;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        HOME_VIEWS.map(({ value }) => [
          value,
          homeOrders.filter((order) => orderMatchesView(order, value)).length,
        ]),
      ) as Record<HomeView, number>,
    [homeOrders],
  );

  const trackingQuery = useQuery({
    queryKey: ["order-tracking", selectedHomeId],
    queryFn: () => orderApi.getTracking(selectedHomeId!),
    enabled: Boolean(selectedHomeId),
    refetchInterval: 15_000,
  });
  const pickupTrackingQuery = useQuery({
    queryKey: ["order-tracking", selectedPickupId],
    queryFn: () => orderApi.getTracking(selectedPickupId!),
    enabled: Boolean(selectedPickupId),
  });
  const eligibleAgentsQuery = useQuery({
    queryKey: ["eligible-delivery-agents", assignmentOrder?._id],
    queryFn: () => deliveryApi.getEligibleAgents(assignmentOrder!._id),
    enabled: Boolean(assignmentOrder && assignmentMode === "IN_HOUSE" && canViewAgents),
  });

  const refreshDeliveryData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pos-store-deliveries"] }),
      queryClient.invalidateQueries({ queryKey: ["order-tracking"] }),
    ]);
  };

  const assignmentMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentOrder) throw new Error("Select an order to assign.");
      if (assignmentMode === "IN_HOUSE") {
        if (!deliveryAgentId) throw new Error("Select a delivery rider.");
        return deliveryApi.assignAgent(assignmentOrder._id, deliveryAgentId);
      }
      if (!provider.trim() || !trackingUrl.trim()) {
        throw new Error("Provider and tracking URL are required.");
      }
      return deliveryApi.assignThirdParty(assignmentOrder._id, {
        provider: provider.trim(),
        trackingUrl: trackingUrl.trim(),
        ...(trackingId.trim() ? { trackingId: trackingId.trim() } : {}),
      });
    },
    onSuccess: async () => {
      toast.success("Delivery assigned");
      closeAssignmentDialog();
      await refreshDeliveryData();
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Delivery could not be assigned.")),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!manualState) throw new Error("Select a delivery action.");
      if (!manualNote.trim()) throw new Error("An audit note is required.");
      const payload = { reason: manualReason, note: manualNote.trim() };
      return manualState.action === "PICKUP"
        ? deliveryApi.manualPickup(manualState.order._id, payload)
        : deliveryApi.manualDelivery(manualState.order._id, payload);
    },
    onSuccess: async () => {
      toast.success(
        manualState?.action === "PICKUP" ? "Delivery marked picked up" : "Delivery completed",
      );
      setManualState(null);
      setManualNote("");
      await refreshDeliveryData();
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Delivery status could not be updated.")),
  });

  const markPackedMutation = useMutation({
    mutationFn: async (order: StoreDeliveryOrder) => {
      const tasksResponse = await fulfillmentApi.listTasks({ storeId, limit: 100 });
      const task = tasksResponse.data.find(
        (entry) => fulfillmentApi.orderIdValue(entry) === order._id,
      );
      if (!task) throw new Error("Packing task was not found for this order.");

      await fulfillmentApi.startPicking(task._id);
      const taskDetail = (await fulfillmentApi.getTask(task._id)).data;
      await Promise.all(
        taskDetail.items.map((item) =>
          fulfillmentApi.recordPick(task._id, {
            fulfillmentItemId: item._id,
            quantityPicked: item.quantityRequested,
          }),
        ),
      );
      return fulfillmentApi.completePicking(task._id);
    },
    onSuccess: async () => {
      toast.success("Order marked packed");
      await refreshDeliveryData();
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Order could not be marked packed.")),
  });

  const pickupConfirmMutation = useMutation({
    mutationFn: (orderId: string) => orderApi.pickupConfirm(orderId),
    onSuccess: async () => {
      toast.success("Customer pickup confirmed");
      await queryClient.invalidateQueries({ queryKey: ["pos-customer-pickups"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to confirm pickup")),
  });

  const printReceiptMutation = useMutation({
    mutationFn: async (order: PosOrder) => {
      setPrintingOrderId(order._id);
      return fetchAndPrintOrderReceipt(order);
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Receipt could not be printed.")),
    onSettled: () => setPrintingOrderId(null),
  });

  function closeAssignmentDialog() {
    setAssignmentOrder(null);
    setAssignmentMode("IN_HOUSE");
    setDeliveryAgentId("");
    setProvider("");
    setTrackingUrl("");
    setTrackingId("");
  }

  const openManualDialog = (order: StoreDeliveryOrder, action: ManualAction) => {
    setManualState({ order, action });
    setManualReason(action === "PICKUP" ? "SCANNER_UNAVAILABLE" : "CUSTOMER_CONFIRMED");
    setManualNote("");
  };

  const copyTrackingLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tracking link copied");
    } catch {
      toast.error("Tracking link could not be copied");
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">Delivery Dispatch</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Assign riders, track handoffs, and close deliveries.
            </p>
          </div>
          {stores.length > 1 ? (
            <div className="w-64">
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger aria-label="Store">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex max-w-xl items-center gap-2 rounded-md border bg-background px-3">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number"
            className="h-11 w-full bg-transparent text-sm font-semibold outline-none"
          />
        </div>
      </header>

      <Tabs defaultValue="home" className="px-5 py-4">
        <TabsList className="h-11">
          <TabsTrigger value="home" className="h-9 gap-2 px-5">
            <Truck className="size-4" /> Home Delivery
          </TabsTrigger>
          <TabsTrigger value="pickup" className="h-9 gap-2 px-5">
            <PackageCheck className="size-4" /> Customer Pickup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {HOME_VIEWS.map((view) => (
              <Button
                key={view.value}
                type="button"
                variant={homeView === view.value ? "default" : "outline"}
                size="sm"
                onClick={() => setHomeView(view.value)}
              >
                {view.label} <span className="tabular-nums opacity-70">{counts[view.value]}</span>
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Refresh deliveries"
              onClick={() => void homeQuery.refetch()}
              disabled={homeQuery.isFetching}
            >
              <RefreshCw className={homeQuery.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="grid min-h-[520px] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <HomeDeliveryTable
              orders={displayedHomeOrders}
              isLoading={homeQuery.isLoading}
              error={homeQuery.error}
              selectedOrderId={selectedHomeId}
              canAssign={canAssign}
              canConfirm={canConfirm}
              canFulfill={canFulfill}
              packingOrderId={
                markPackedMutation.isPending ? markPackedMutation.variables?._id ?? null : null
              }
              onSelect={setSelectedHomeId}
              onAssign={setAssignmentOrder}
              onMarkPacked={(order) => markPackedMutation.mutate(order)}
              onManual={openManualDialog}
            />
            <DispatchDetail
              order={selectedHomeOrder}
              isTrackingLoading={trackingQuery.isLoading}
              trackingError={trackingQuery.error}
              location={trackingQuery.data?.data.location}
              onCopyLink={copyTrackingLink}
            />
          </div>
        </TabsContent>

        <TabsContent value="pickup" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <FulfillmentOrderSection
              title="Pickup Ready / In Progress"
              orders={pickupOrders}
              isLoading={pickupQuery.isLoading}
              isError={pickupQuery.isError}
              error={pickupQuery.error}
              onRetry={() => void pickupQuery.refetch()}
              onSelect={setSelectedPickupId}
              onPrintReceipt={(order) => printReceiptMutation.mutate(order)}
              onPickupConfirm={(orderId) => pickupConfirmMutation.mutate(orderId)}
              pickupPending={pickupConfirmMutation.isPending}
              printPendingOrderId={printingOrderId}
            />
            <FulfillmentTrackingPanel
              selectedOrderId={selectedPickupId}
              tracking={pickupTrackingQuery.data?.data}
              isLoading={pickupTrackingQuery.isLoading}
              isError={pickupTrackingQuery.isError}
              error={pickupTrackingQuery.error}
              onRetry={() => void pickupTrackingQuery.refetch()}
            />
          </div>
        </TabsContent>
      </Tabs>

      <AssignmentDialog
        order={assignmentOrder}
        mode={assignmentMode}
        onModeChange={setAssignmentMode}
        deliveryAgentId={deliveryAgentId}
        onAgentChange={setDeliveryAgentId}
        agents={eligibleAgentsQuery.data?.data ?? []}
        agentsLoading={eligibleAgentsQuery.isLoading}
        agentsError={eligibleAgentsQuery.error}
        provider={provider}
        onProviderChange={setProvider}
        trackingUrl={trackingUrl}
        onTrackingUrlChange={setTrackingUrl}
        trackingId={trackingId}
        onTrackingIdChange={setTrackingId}
        pending={assignmentMutation.isPending}
        onClose={closeAssignmentDialog}
        onSubmit={() => assignmentMutation.mutate()}
      />

      <ManualActionDialog
        state={manualState}
        reason={manualReason}
        onReasonChange={setManualReason}
        note={manualNote}
        onNoteChange={setManualNote}
        pending={manualMutation.isPending}
        onClose={() => setManualState(null)}
        onSubmit={() => manualMutation.mutate()}
      />
    </div>
  );
}

function HomeDeliveryTable({
  orders,
  isLoading,
  error,
  selectedOrderId,
  canAssign,
  canConfirm,
  canFulfill,
  packingOrderId,
  onSelect,
  onAssign,
  onMarkPacked,
  onManual,
}: {
  orders: StoreDeliveryOrder[];
  isLoading: boolean;
  error: unknown;
  selectedOrderId: string | null;
  canAssign: boolean;
  canConfirm: boolean;
  canFulfill: boolean;
  packingOrderId: string | null;
  onSelect: (orderId: string) => void;
  onAssign: (order: StoreDeliveryOrder) => void;
  onMarkPacked: (order: StoreDeliveryOrder) => void;
  onManual: (order: StoreDeliveryOrder, action: ManualAction) => void;
}) {
  return (
    <div className="overflow-x-auto border bg-white">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-secondary text-xs font-bold uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-3 text-left">Order</th>
            <th className="px-3 py-3 text-left">Customer</th>
            <th className="px-3 py-3 text-left">Payment</th>
            <th className="px-3 py-3 text-left">Packed</th>
            <th className="px-3 py-3 text-left">Assignment</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <TableMessage
              icon={<Loader2 className="animate-spin" />}
              message="Loading deliveries"
            />
          ) : error ? (
            <TableMessage message={getErrorMessage(error, "Deliveries could not be loaded.")} />
          ) : orders.length === 0 ? (
            <TableMessage message="No deliveries match this view." />
          ) : (
            orders.map((order) => {
              const assignment = order.deliveryAssignment;
              return (
                <tr
                  key={order._id}
                  className={selectedOrderId === order._id ? "border-t bg-blue-50" : "border-t"}
                >
                  <td className="px-3 py-3">
                    <button className="text-left" onClick={() => onSelect(order._id)}>
                      <div className="font-extrabold text-primary">{order.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold">{order.customerId?.name || "Customer"}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.deliveryAddressSnapshot?.phone ||
                        order.customerId?.mobile ||
                        "No phone"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold">{order.paymentMode}</div>
                    <div className="text-xs text-muted-foreground">
                      ₹{order.grandTotal.toLocaleString("en-IN")}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold">
                    {formatDateTime(order.updatedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <AssignmentLabel assignment={assignment} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={assignment?.status || order.fulfillmentStatus || "UNASSIGNED"}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => onSelect(order._id)}>
                        View
                      </Button>
                      {canAssign && order.isDeliveryAssignable ? (
                        <Button size="sm" onClick={() => onAssign(order)}>
                          <UserRound /> Assign
                        </Button>
                      ) : null}
                      {canFulfill && !assignment && !order.isDeliveryAssignable ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onMarkPacked(order)}
                          disabled={packingOrderId === order._id}
                        >
                          {packingOrderId === order._id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <PackageCheck />
                          )}
                          Mark Packed
                        </Button>
                      ) : null}
                      {canConfirm && assignment?.status === "ASSIGNED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onManual(order, "PICKUP")}
                        >
                          <Bike /> Picked Up
                        </Button>
                      ) : null}
                      {canConfirm &&
                      ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(assignment?.status || "") ? (
                        <Button size="sm" onClick={() => onManual(order, "DELIVER")}>
                          <CheckCircle2 /> Delivered
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableMessage({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <tr>
      <td colSpan={7} className="h-40 px-4 text-center text-sm font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          {icon}
          {message}
        </span>
      </td>
    </tr>
  );
}

function AssignmentLabel({ assignment }: { assignment: DeliveryAssignment | null }) {
  if (!assignment)
    return <span className="text-xs font-semibold text-muted-foreground">Not assigned</span>;
  if (assignment.mode === "THIRD_PARTY") {
    return (
      <div>
        <div className="font-bold">{assignment.thirdPartyProvider}</div>
        <div className="text-xs text-muted-foreground">Third party</div>
      </div>
    );
  }
  return (
    <div>
      <div className="font-bold">
        {assignment.deliveryAgent
          ? `${assignment.deliveryAgent.firstName} ${assignment.deliveryAgent.lastName || ""}`.trim()
          : "Rider assigned"}
      </div>
      <div className="text-xs text-muted-foreground">{assignment.deliveryAgent?.agentCode}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "DELIVERED"
      ? "bg-green-100 text-green-800"
      : status === "FAILED"
        ? "bg-red-100 text-red-800"
        : status === "PICKED_UP" || status === "OUT_FOR_DELIVERY"
          ? "bg-orange-100 text-orange-800"
          : status === "ASSIGNED"
            ? "bg-blue-100 text-blue-800"
            : "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${styles}`}>{status}</span>
  );
}

function DispatchDetail({
  order,
  isTrackingLoading,
  trackingError,
  location,
  onCopyLink,
}: {
  order: StoreDeliveryOrder | null;
  isTrackingLoading: boolean;
  trackingError: unknown;
  location?: { latitude?: number; longitude?: number; updatedAt?: string } | null;
  onCopyLink: (url: string) => void;
}) {
  if (!order) {
    return (
      <aside className="border bg-white p-5 text-sm font-semibold text-muted-foreground">
        Select a delivery to view dispatch details.
      </aside>
    );
  }
  const assignment = order.deliveryAssignment;
  return (
    <aside className="border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground">Dispatch Detail</div>
          <h2 className="mt-1 text-lg font-extrabold">{order.orderNumber}</h2>
        </div>
        <StatusBadge status={assignment?.status || "UNASSIGNED"} />
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <Detail label="Customer" value={order.customerId?.name || "Customer"} />
        <Detail
          label="Phone"
          value={order.deliveryAddressSnapshot?.phone || order.customerId?.mobile || "Not provided"}
        />
        <Detail label="Address" value={formatAddress(order) || "Not provided"} />
        <Detail
          label="Payment"
          value={`${order.paymentMode} · ₹${order.grandTotal.toLocaleString("en-IN")}`}
        />
        <Detail label="Assigned" value={formatDateTime(assignment?.assignedAt)} />
        <Detail label="Picked up" value={formatDateTime(assignment?.pickedUpAt)} />
        <Detail label="Delivered" value={formatDateTime(assignment?.deliveredAt)} />
      </dl>

      {assignment?.mode === "THIRD_PARTY" && assignment.thirdPartyTrackingUrl ? (
        <div className="mt-5 border-t pt-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Third-party tracking
          </div>
          <div className="mt-1 font-bold">{assignment.thirdPartyProvider}</div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyLink(assignment.thirdPartyTrackingUrl!)}
            >
              <Clipboard /> Copy Link
            </Button>
            <Button asChild size="sm">
              <a href={assignment.thirdPartyTrackingUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Open
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {assignment?.pickupManualNote || assignment?.deliveryManualNote ? (
        <div className="mt-5 border-t pt-4 text-sm">
          <div className="text-xs font-bold uppercase text-muted-foreground">Manager audit</div>
          {assignment.pickupManualNote ? (
            <p className="mt-2">
              <strong>Pickup:</strong> {assignment.pickupManualNote}
            </p>
          ) : null}
          {assignment.deliveryManualNote ? (
            <p className="mt-2">
              <strong>Delivery:</strong> {assignment.deliveryManualNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 border-t pt-4 text-xs font-semibold text-muted-foreground">
        {isTrackingLoading
          ? "Refreshing tracking…"
          : trackingError
            ? getErrorMessage(trackingError, "Tracking unavailable")
            : location?.updatedAt
              ? `Last rider update ${formatDateTime(location.updatedAt)}`
              : "No rider location reported"}
      </div>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function AssignmentDialog({
  order,
  mode,
  onModeChange,
  deliveryAgentId,
  onAgentChange,
  agents,
  agentsLoading,
  agentsError,
  provider,
  onProviderChange,
  trackingUrl,
  onTrackingUrlChange,
  trackingId,
  onTrackingIdChange,
  pending,
  onClose,
  onSubmit,
}: {
  order: StoreDeliveryOrder | null;
  mode: AssignmentMode;
  onModeChange: (mode: AssignmentMode) => void;
  deliveryAgentId: string;
  onAgentChange: (value: string) => void;
  agents: DeliveryAgentRef[];
  agentsLoading: boolean;
  agentsError: unknown;
  provider: string;
  onProviderChange: (value: string) => void;
  trackingUrl: string;
  onTrackingUrlChange: (value: string) => void;
  trackingId: string;
  onTrackingIdChange: (value: string) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Delivery</DialogTitle>
          <DialogDescription>
            {order?.orderNumber} is packed and ready for dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-md bg-secondary p-1">
          <Button
            type="button"
            variant={mode === "IN_HOUSE" ? "default" : "ghost"}
            onClick={() => onModeChange("IN_HOUSE")}
          >
            <Bike /> In-house
          </Button>
          <Button
            type="button"
            variant={mode === "THIRD_PARTY" ? "default" : "ghost"}
            onClick={() => onModeChange("THIRD_PARTY")}
          >
            <Truck /> Third-party
          </Button>
        </div>

        {mode === "IN_HOUSE" ? (
          <div>
            <Label className="mb-2 block">Delivery rider</Label>
            {agentsLoading ? (
              <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" /> Loading riders
              </div>
            ) : agentsError ? (
              <div className="text-sm font-semibold text-destructive">
                {getErrorMessage(agentsError, "Riders could not be loaded.")}
              </div>
            ) : (
              <Select value={deliveryAgentId} onValueChange={onAgentChange}>
                <SelectTrigger aria-label="Delivery rider">
                  <SelectValue placeholder="Select rider" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent._id} value={agent._id}>
                      {agent.firstName} {agent.lastName || ""} · {agent.currentStatus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                className="mt-2"
                value={provider}
                onChange={(event) => onProviderChange(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tracking-url">Tracking URL</Label>
              <Input
                id="tracking-url"
                type="url"
                className="mt-2"
                value={trackingUrl}
                onChange={(event) => onTrackingUrlChange(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tracking-id">Tracking ID (optional)</Label>
              <Input
                id="tracking-id"
                className="mt-2"
                value={trackingId}
                onChange={(event) => onTrackingIdChange(event.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ? <Loader2 className="animate-spin" /> : <UserRound />} Assign Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualActionDialog({
  state,
  reason,
  onReasonChange,
  note,
  onNoteChange,
  pending,
  onClose,
  onSubmit,
}: {
  state: { order: StoreDeliveryOrder; action: ManualAction } | null;
  reason: ManualDeliveryReason;
  onReasonChange: (reason: ManualDeliveryReason) => void;
  note: string;
  onNoteChange: (note: string) => void;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isPickup = state?.action === "PICKUP";
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPickup ? "Mark Picked Up" : "Mark Delivered"}</DialogTitle>
          <DialogDescription>
            This manager override will be permanently recorded for {state?.order.orderNumber}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Reason</Label>
            <Select
              value={reason}
              onValueChange={(value) => onReasonChange(value as ManualDeliveryReason)}
            >
              <SelectTrigger className="mt-2" aria-label="Override reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_REASONS.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="manual-note">Audit note</Label>
            <Textarea
              id="manual-note"
              className="mt-2 min-h-24"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Record how this status was confirmed"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !note.trim()} onClick={onSubmit}>
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : isPickup ? (
              <Bike />
            ) : (
              <CheckCircle2 />
            )}
            Confirm {isPickup ? "Pickup" : "Delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
