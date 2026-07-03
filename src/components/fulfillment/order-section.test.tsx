import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FulfillmentOrderSection, FulfillmentTrackingPanel } from "./order-section";
import type { PosOrder } from "@/lib/order-api";

const baseOrder: PosOrder = {
  _id: "order-1",
  organizationId: "org-1",
  orderNumber: "ORD-001",
  orderType: "ONLINE",
  storeId: { _id: "store-1", storeName: "Main Store", storeCode: "MS1" },
  customerId: { _id: "customer-1", name: "Rahul", mobile: "9999999999" },
  status: "PLACED",
  fulfillmentStatus: "READY_FOR_PICKUP",
  subtotal: 100,
  tax: 0,
  discount: 0,
  delivery: 0,
  grandTotal: 100,
  paymentMode: "CARD",
  deliveryType: "PICKUP",
  createdAt: "2026-07-02T08:15:00.000Z",
  updatedAt: "2026-07-02T08:15:00.000Z",
};

describe("FulfillmentOrderSection", () => {
  it("renders pickup confirmation for pickup orders", () => {
    const onPickupConfirm = vi.fn();
    render(
      <FulfillmentOrderSection
        title="Pickup Ready"
        orders={[baseOrder]}
        isLoading={false}
        onSelect={vi.fn()}
        onPickupConfirm={onPickupConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pickup Confirm" }));
    expect(onPickupConfirm).toHaveBeenCalledWith("order-1");
  });

  it("hides pickup confirmation for home delivery rows", () => {
    render(
      <FulfillmentOrderSection
        title="Home Delivery"
        orders={[{ ...baseOrder, _id: "order-2", deliveryType: "HOME" }]}
        isLoading={false}
        onSelect={vi.fn()}
        onPickupConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Pickup Confirm" })).not.toBeInTheDocument();
  });

  it("renders and triggers print receipt action", () => {
    const onPrintReceipt = vi.fn();
    render(
      <FulfillmentOrderSection
        title="Pickup Ready"
        orders={[baseOrder]}
        isLoading={false}
        onSelect={vi.fn()}
        onPrintReceipt={onPrintReceipt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Print Receipt" }));
    expect(onPrintReceipt).toHaveBeenCalledWith(baseOrder);
  });
});

describe("FulfillmentTrackingPanel", () => {
  it("renders tracking state from API data", () => {
    render(
      <FulfillmentTrackingPanel
        selectedOrderId="order-1"
        isLoading={false}
        tracking={{
          orderId: "ORD-001",
          status: "PLACED",
          fulfillmentStatus: "OUT_FOR_DELIVERY",
          deliveryOrderStatus: "ASSIGNED",
          estimatedDeliveryAt: "2026-07-02T09:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("ORD-001")).toBeInTheDocument();
    expect(screen.getByText(/OUT_FOR_DELIVERY/)).toBeInTheDocument();
    expect(screen.getByText(/ASSIGNED/)).toBeInTheDocument();
  });
});
