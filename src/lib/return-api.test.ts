import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  post: vi.fn().mockResolvedValue({ data: { _id: "return-1" } }),
}));
vi.mock("./api", () => ({ api: { post: mocks.post } }));
import { returnApi } from "./return-api";

describe("return submission contract", () => {
  it("sends the same idempotency key on a retry without creating refunds or fulfilling stock", async () => {
    const payload: Parameters<typeof returnApi.create>[0] = {
      orderId: "order-1",
      channel: "IN_STORE",
      issueType: "CUSTOMER_RETURN",
      resolutionType: "REFUND",
      refundMethod: "CASH",
      receiptVerified: true,
      reason: "Damaged packaging",
      items: [{ orderItemId: "item-1", quantity: 1, disposition: "DAMAGED" }],
    };
    await returnApi.create(payload, "retry-key-1");
    await returnApi.create(payload, "retry-key-1");
    expect(mocks.post).toHaveBeenCalledTimes(2);
    for (const call of mocks.post.mock.calls) {
      expect(call).toEqual([
        "/returns",
        payload,
        { headers: { "Idempotency-Key": "retry-key-1" } },
      ]);
    }
  });
});
