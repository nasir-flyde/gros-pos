import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";
import type { StoreDeliveryOrder } from "@/lib/order-api";

const mocks = vi.hoisted(() => ({
  listStoreDeliveries: vi.fn(),
  list: vi.fn(),
  getTracking: vi.fn(),
  pickupConfirm: vi.fn(),
  getEligibleAgents: vi.fn(),
  assignAgent: vi.fn(),
  assignThirdParty: vi.fn(),
  manualPickup: vi.fn(),
  manualDelivery: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  startPicking: vi.fn(),
  recordPick: vi.fn(),
  completePicking: vi.fn(),
}));

vi.mock("@/lib/order-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/order-api")>();
  return {
    ...original,
    orderApi: {
      ...original.orderApi,
      listStoreDeliveries: mocks.listStoreDeliveries,
      list: mocks.list,
      getTracking: mocks.getTracking,
      pickupConfirm: mocks.pickupConfirm,
    },
  };
});

vi.mock("@/lib/delivery-api", () => ({
  deliveryApi: {
    getEligibleAgents: mocks.getEligibleAgents,
    assignAgent: mocks.assignAgent,
    assignThirdParty: mocks.assignThirdParty,
    manualPickup: mocks.manualPickup,
    manualDelivery: mocks.manualDelivery,
  },
}));

vi.mock("@/lib/fulfillment-api", () => ({
  fulfillmentApi: {
    listTasks: mocks.listTasks,
    getTask: mocks.getTask,
    startPicking: mocks.startPicking,
    recordPick: mocks.recordPick,
    completePicking: mocks.completePicking,
    orderIdValue: (task: { orderId: string | { _id: string } }) =>
      typeof task.orderId === "string" ? task.orderId : task.orderId._id,
  },
}));

vi.mock("@/lib/order-receipt", () => ({ fetchAndPrintOrderReceipt: vi.fn() }));

import { DeliveryPage } from "./_pos.delivery";

const readyOrder: StoreDeliveryOrder = {
  _id: "order-1",
  orderNumber: "ORD-1001",
  orderType: "ONLINE",
  status: "PLACED",
  fulfillmentStatus: "PACKED",
  paymentStatus: "PENDING",
  subtotal: 500,
  tax: 0,
  discount: 0,
  delivery: 30,
  grandTotal: 530,
  paymentMode: "COD",
  deliveryType: "HOME",
  customerId: { _id: "customer-1", name: "Asha", mobile: "9000000000" },
  storeId: { _id: "store-1", storeName: "Main Store", storeCode: "MAIN" },
  deliveryAddressSnapshot: { line1: "12 Market Road", city: "Mumbai", pincode: "400001" },
  isDeliveryAssignable: true,
  deliveryAssignment: null,
  createdAt: "2026-08-10T08:00:00.000Z",
  updatedAt: "2026-08-10T08:30:00.000Z",
};

const pendingPackingOrder: StoreDeliveryOrder = {
  ...readyOrder,
  _id: "order-2",
  orderNumber: "ORD-1002",
  fulfillmentStatus: "RESERVED",
  isDeliveryAssignable: false,
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DeliveryPage />
    </QueryClientProvider>,
  );
};

describe("DeliveryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setGrosAccess({
      user: {
        id: "manager-1",
        firstName: "Store",
        lastName: "Manager",
        email: "manager@example.com",
        phone: "9000000001",
        isSuperAdmin: false,
        organizationId: "org-1",
      },
      permissions: [
        "order.read",
        "delivery.manifest.view",
        "delivery.manifest.create",
        "delivery.confirm",
        "order.fulfill",
      ],
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
    });
    mocks.listStoreDeliveries.mockResolvedValue({ data: [readyOrder] });
    mocks.list.mockResolvedValue({ data: [] });
    mocks.getTracking.mockResolvedValue({ data: { orderId: "order-1", status: "PLACED" } });
    mocks.getEligibleAgents.mockResolvedValue({ data: [] });
    mocks.assignThirdParty.mockResolvedValue({ data: {} });
    mocks.listTasks.mockResolvedValue({ data: [{ _id: "task-1", orderId: "order-2" }] });
    mocks.getTask.mockResolvedValue({
      data: {
        _id: "task-1",
        orderId: "order-2",
        storeId: "store-1",
        status: "PENDING",
        items: [{ _id: "fulfillment-item-1", quantityRequested: 2 }],
      },
    });
    mocks.startPicking.mockResolvedValue({ data: { _id: "task-1" } });
    mocks.recordPick.mockResolvedValue({ data: { _id: "fulfillment-item-1" } });
    mocks.completePicking.mockResolvedValue({ data: { _id: "task-1" } });
  });

  it("renders the two workflows and assigns a third-party provider", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Ready to Assign/i }));

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Home Delivery/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Customer Pickup/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Assign$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Third-party/i }));
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "FastShip" } });
    fireEvent.change(screen.getByLabelText("Tracking URL"), {
      target: { value: "https://tracking.example.com/T-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Assign Delivery/i }));

    await waitFor(() =>
      expect(mocks.assignThirdParty).toHaveBeenCalledWith("order-1", {
        provider: "FastShip",
        trackingUrl: "https://tracking.example.com/T-1",
      }),
    );
  });

  it("shows unassigned home deliveries before packing is complete", async () => {
    mocks.listStoreDeliveries.mockResolvedValue({ data: [pendingPackingOrder] });

    renderPage();

    expect(await screen.findByText("ORD-1002")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending Packing 1/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Assign$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark Packed/i })).toBeInTheDocument();
  });

  it("marks all fulfillment items packed for a pending delivery", async () => {
    mocks.listStoreDeliveries.mockResolvedValue({ data: [pendingPackingOrder] });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Mark Packed/i }));

    await waitFor(() => expect(mocks.completePicking).toHaveBeenCalledWith("task-1"));
    expect(mocks.startPicking).toHaveBeenCalledWith("task-1");
    expect(mocks.recordPick).toHaveBeenCalledWith("task-1", {
      fulfillmentItemId: "fulfillment-item-1",
      quantityPicked: 2,
    });
  });

  it("hides dispatch actions without manager permissions", async () => {
    useAuthStore.setState({ permissions: ["order.read"] });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Ready to Assign/i }));

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Assign$/i })).not.toBeInTheDocument();
  });
});
