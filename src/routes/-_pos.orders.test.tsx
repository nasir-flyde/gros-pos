import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  returns: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/order-api", () => ({ orderApi: { list: mocks.list, getById: mocks.get } }));
vi.mock("@/lib/return-api", () => ({ returnApi: { list: mocks.returns, create: mocks.create } }));
vi.mock("@/lib/use-live-catalog", () => ({
  useLiveCatalog: () => ({ data: { variants: [] }, isLoading: false }),
}));
import { Route } from "./_pos.orders";
const OrdersPage = Route.options.component as ComponentType;
const order = {
  _id: "order-1",
  orderNumber: "ORD-1",
  status: "COMPLETED",
  paymentMode: "CASH",
  grandTotal: 100,
  createdAt: "2026-09-01T00:00:00Z",
  storeId: "store-1",
  items: [
    {
      _id: "item-1",
      productVariantId: "variant-1",
      variantName: "Rice",
      sku: "RICE",
      quantity: 2,
      lineTotal: 100,
    },
  ],
};
const record = { _id: "return-1", returnNumber: "RET-1", status: "REQUESTED" };
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrdersPage />
    </QueryClientProvider>,
  );
}
async function prepareReturn() {
  fireEvent.click(await screen.findByText("ORD-1"));
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.change(screen.getByPlaceholderText("Reason for return or exchange"), {
    target: { value: "Damaged packaging" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeEnabled(),
  );
  return screen.getByRole("button", { name: "Submit for approval" });
}

describe("Orders approval-based returns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setGrosAccess({
      user: {
        id: "user-1",
        organizationId: "org-1",
        firstName: "Cashier",
        lastName: "One",
        email: "cashier@example.test",
        phone: "9000000000",
        isSuperAdmin: false,
      },
      permissions: ["order.read", "return.read", "return.write"],
      scopes: [{ type: "store", id: "store-1", name: "Store One" }],
    });
    mocks.list.mockResolvedValue({ data: [order] });
    mocks.get.mockResolvedValue({ data: order });
    mocks.returns.mockResolvedValue({ data: [] });
    mocks.create.mockResolvedValue({ data: record });
  });
  it("does not request orders without order.read", () => {
    useAuthStore.setState({ permissions: [] });
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Order read permission required");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("requires return.write even when the order is readable", async () => {
    useAuthStore.setState({ permissions: ["order.read", "return.read"] });
    mount();
    fireEvent.click(await screen.findByText("ORD-1"));
    expect(await screen.findByRole("button", { name: "Submit for approval" })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("blocks another request when one is awaiting approval", async () => {
    mocks.returns.mockResolvedValue({ data: [record] });
    mount();
    fireEvent.click(await screen.findByText("ORD-1"));
    expect(await screen.findByText("RET-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
  });
  it("submits once during rapid clicks and never posts a refund directly", async () => {
    let finish!: (value: unknown) => void;
    mocks.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    mount();
    const submit = await prepareReturn();
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    finish({ data: record });
    expect(
      await screen.findByText(
        "No refund, payment, exchange, or stock movement has been posted yet.",
      ),
    ).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        channel: "IN_STORE",
        resolutionType: "REFUND",
        items: [{ orderItemId: "item-1", quantity: 1, disposition: "SELLABLE" }],
      }),
      expect.any(String),
    );
  });
  it("reuses the idempotency key after an ambiguous network failure", async () => {
    mocks.create
      .mockRejectedValueOnce(new Error("Network disconnected"))
      .mockResolvedValueOnce({ data: record });
    mount();
    const submit = await prepareReturn();
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0][1]).toBe(mocks.create.mock.calls[1][1]);
  });
});
