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
      ],
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
    });
    mocks.listStoreDeliveries.mockResolvedValue({ data: [readyOrder] });
    mocks.list.mockResolvedValue({ data: [] });
    mocks.getTracking.mockResolvedValue({ data: { orderId: "order-1", status: "PLACED" } });
    mocks.getEligibleAgents.mockResolvedValue({ data: [] });
    mocks.assignThirdParty.mockResolvedValue({ data: {} });
  });

  it("renders the two workflows and assigns a third-party provider", async () => {
    renderPage();

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

  it("hides dispatch actions without manager permissions", async () => {
    useAuthStore.setState({ permissions: ["order.read"] });
    renderPage();

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Assign$/i })).not.toBeInTheDocument();
  });
});
