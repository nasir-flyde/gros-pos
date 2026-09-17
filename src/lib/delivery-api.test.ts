import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: { get: apiGet, post: apiPost },
}));

import { deliveryApi } from "./delivery-api";

describe("deliveryApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses store-manager dispatch endpoints", async () => {
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockResolvedValue({ data: {} });

    await deliveryApi.getEligibleAgents("order-1");
    await deliveryApi.assignAgent("order-1", "agent-1");
    await deliveryApi.assignThirdParty("order-1", {
      provider: "FastShip",
      trackingUrl: "https://tracking.example.com/T-1",
    });
    await deliveryApi.manualPickup("order-1", {
      reason: "SCANNER_UNAVAILABLE",
      note: "Camera unavailable",
    });
    await deliveryApi.manualDelivery("order-1", {
      reason: "CUSTOMER_CONFIRMED",
      note: "Customer confirmed delivery",
    });

    expect(apiGet).toHaveBeenCalledWith("/delivery/agents/eligible", {
      params: { orderId: "order-1" },
    });
    expect(apiPost).toHaveBeenCalledWith("/delivery/orders/order-1/assign-agent", {
      deliveryAgentId: "agent-1",
    });
    expect(apiPost).toHaveBeenCalledWith(
      "/delivery/orders/order-1/assign-third-party",
      expect.objectContaining({ provider: "FastShip" }),
    );
    expect(apiPost).toHaveBeenCalledWith(
      "/delivery/orders/order-1/manual-picked-up",
      expect.objectContaining({ reason: "SCANNER_UNAVAILABLE" }),
    );
    expect(apiPost).toHaveBeenCalledWith(
      "/delivery/orders/order-1/manual-delivered",
      expect.objectContaining({ reason: "CUSTOMER_CONFIRMED" }),
    );
  });
});
