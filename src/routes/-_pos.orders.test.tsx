import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  listReturns: vi.fn(),
  orderList: vi.fn(),
  orderDetail: vi.fn(),
  catalog: { variants: [] as unknown[] },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));
vi.mock("@/lib/auth-store", () => ({
  useAuthStore: () => ({
    scopes: [{ type: "store", id: "store-1" }],
    permissions: ["order.read", "return.read", "return.write"],
  }),
}));
vi.mock("@/lib/order-api", () => ({
  orderApi: { list: mocks.orderList, getById: mocks.orderDetail },
}));
vi.mock("@/lib/return-api", () => ({
  returnApi: { list: mocks.listReturns, create: mocks.create },
}));
vi.mock("@/lib/use-live-catalog", () => ({
  useLiveCatalog: () => ({ data: mocks.catalog, isLoading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { Route } from "./_pos.orders";
const Component = (Route as unknown as { component: ComponentType }).component;
const baseOrder = {
  _id: "order-1",
  orderNumber: "ORD-1",
  status: "COMPLETED",
  createdAt: "2026-09-30T00:00:00Z",
  grandTotal: 100,
  paymentMode: "CASH",
  items: [
    {
      _id: "original",
      variantName: "Original product",
      quantity: 1,
      unitPrice: 100,
      lineTotal: 100,
      sellingMode: "FIXED",
    },
  ],
};
const variant = (price: number) => ({
  _id: "replacement",
  variantName: "Cheaper product",
  sellingMode: "FIXED",
  sku: "CHEAP",
  barcodes: ["001234"],
  price,
  quantityAvailable: 10,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.orderList.mockResolvedValue({ data: [baseOrder] });
  mocks.orderDetail.mockResolvedValue({ data: baseOrder });
  mocks.listReturns.mockResolvedValue({ data: [] });
  mocks.create.mockResolvedValue({
    data: { _id: "return-1", returnNumber: "RTN-1", status: "REQUESTED", items: [] },
  });
  mocks.catalog.variants = [variant(50)];
});
async function open() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /ORD-1/ }));
  await screen.findByLabelText("Return quantity for Original product");
  fireEvent.change(screen.getByLabelText("Return quantity for Original product"), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Different item" }));
  fireEvent.click(screen.getByRole("button", { name: /Cheaper product/ }));
  fireEvent.change(screen.getByPlaceholderText("Reason for return or exchange"), {
    target: { value: "Customer exchange" },
  });
}
describe("POS replacement quantity screen", () => {
  it.each([
    [2, 50, "Even exchange", false],
    [3, 40, "Due after approval ₹20", false],
    [2, 40, "Refund ₹20", true],
  ])(
    "supports %i replacements at %i and sends independent quantity",
    async (quantity, price, balance, refund) => {
      mocks.catalog.variants = [variant(price)];
      await open();
      fireEvent.change(screen.getByLabelText("Replacement quantity for Original product"), {
        target: { value: String(quantity) },
      });
      expect(screen.getByText(balance)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Submit for approval" }));
      await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
      expect(mocks.create.mock.calls[0][0]).toMatchObject({
        resolutionType: "DIFFERENT_ITEM_EXCHANGE",
        items: [
          {
            orderItemId: "original",
            quantity: 1,
            replacementProductVariantId: "replacement",
            replacementQuantity: quantity,
          },
        ],
      });
      expect(mocks.create.mock.calls[0][0].refundMethod).toBe(refund ? "CASH" : undefined);
    },
  );
  it("blocks bad quantity/stock and resets when SKU or order changes", async () => {
    await open();
    const input = screen.getByLabelText("Replacement quantity for Original product");
    fireEvent.change(input, { target: { value: "1.5" } });
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "11" } });
    expect(screen.getByRole("alert")).toHaveTextContent("stock");
    fireEvent.change(input, { target: { value: "2" } });
    expect(screen.getByText("Even exchange")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cheaper product/ }));
    expect(screen.getByLabelText("Replacement quantity for Original product")).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to orders" }));
    fireEvent.click(await screen.findByRole("button", { name: /ORD-1/ }));
    await screen.findByLabelText("Return quantity for Original product");
    expect(screen.getByLabelText("Return quantity for Original product")).toHaveValue(0);
    expect(screen.queryByLabelText("Replacement quantity for Original product")).toBeNull();
  });
  it("caps original quantity by previously returned quantity", async () => {
    mocks.listReturns.mockResolvedValue({
      data: [{ status: "FULFILLED", items: [{ orderItemId: "original", requestedQuantity: 1 }] }],
    });
    await open();
    expect(screen.getByLabelText("Return quantity for Original product")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeDisabled();
  });
});
