import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const clearMock = vi.fn();
const setLastCheckoutMock = vi.fn();
const updateStockLevelsMock = vi.fn();
const checkoutMock = vi.fn();
const quoteMock = vi.fn();
const stockMock = vi.fn();
const invalidateQueriesMock = vi.fn();

const cartState = {
  items: [
    {
      product: {
        _id: "variant-1",
        name: "Atta 5kg",
        weight: "5 kg",
        mrp: 320,
        price: 299,
        taxRate: 5,
        quantityAvailable: 2,
      },
      qty: 2,
    },
  ],
  customer: null,
  subtotal: 640,
  discount: 42,
  afterDisc: 598,
  tax: 28,
  activeOrderId: null,
};

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    ...cartState,
    clear: clearMock,
    setLastCheckout: setLastCheckoutMock,
    updateStockLevels: updateStockLevelsMock,
  }),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: { id: "cashier-1" },
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
    }),
}));

vi.mock("@/lib/order-api", () => ({
  orderApi: {
    quoteCheckout: (...args: unknown[]) => quoteMock(...args),
    checkout: (...args: unknown[]) => checkoutMock(...args),
    requestPaytmPosPayment: vi.fn(),
    getPaytmPosPaymentStatus: vi.fn(),
  },
}));

vi.mock("@/lib/product-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-api")>();
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getStoreVariantStock: (...args: unknown[]) => stockMock(...args),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useNavigate: () => navigateMock,
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  useQuery: (options: { queryKey: unknown[] }) =>
    options.queryKey[0] === "pos-checkout-quote"
      ? {
          data: {
            data: {
              items: [],
              totals: {
                subtotal: 598,
                tax: 28,
                catalogDiscount: 33.45,
                manualDiscount: 0,
                discount: 33.45,
                discountPercent: 0,
                delivery: 0,
                grandTotal: 564.55,
              },
              appliedOffers: [
                { promotionId: "offer-1", name: "Store offer", discountAmount: 5.45 },
              ],
              coupon: null,
              couponDecision: {},
              quoteVersion: "123456789012345678901234",
            },
          },
          error: null,
          isPending: false,
          isError: false,
          refetch: vi.fn(),
        }
      : { data: undefined, error: null, isPending: false, isError: false, refetch: vi.fn() },
  useMutation: (options: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: (result: unknown) => void;
    onError?: (error: unknown) => void;
    onSettled?: () => void;
  }) => ({
    isPending: false,
    mutate: () => {
      void options
        .mutationFn()
        .then((result) => options.onSuccess?.(result))
        .catch((error) => options.onError?.(error))
        .finally(() => options.onSettled?.());
    },
  }),
}));

import { Route as CheckoutRoute } from "./_pos.checkout";

const CheckoutPage = (
  CheckoutRoute as unknown as { component?: ComponentType; options?: { component?: ComponentType } }
).component!;

describe("Checkout production states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quoteMock.mockResolvedValue({ data: { coupon: { code: "SAVE10", discountAmount: 10 } } });
    stockMock.mockResolvedValue([{ _id: "variant-1", quantityAvailable: 2 }]);
    checkoutMock.mockResolvedValue({
      data: {
        order: { _id: "order-1", orderNumber: "POS-1", grandTotal: 564.55 },
        receipt: null,
        receiptStatus: "generated",
      },
    });
  });

  it("blocks checkout when split payments do not match the total", () => {
    render(<CheckoutPage />);

    const splitButton = screen.getByText("Split").closest("button");
    expect(splitButton).not.toBeNull();
    fireEvent.click(splitButton as HTMLButtonElement);

    expect(
      screen.getByText("Split payment amounts must add up exactly before checkout."),
    ).toBeInTheDocument();
    expect(screen.getByText(/place order/i).closest("button")).toBeDisabled();
  });

  it("refreshes live stock and blocks checkout when stock changed", async () => {
    stockMock.mockResolvedValue([{ _id: "variant-1", quantityAvailable: 1 }]);

    render(<CheckoutPage />);

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    expect(await screen.findByText(/stock changed before checkout/i)).toBeInTheDocument();
    expect(updateStockLevelsMock).toHaveBeenCalledWith({ "variant-1": 1 });
    expect(checkoutMock).not.toHaveBeenCalled();
  });

  it("finishes checkout after live stock passes", async () => {
    render(<CheckoutPage />);

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(checkoutMock).toHaveBeenCalledOnce());
    expect(checkoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payments: [{ paymentMode: "UPI", amount: 564.55 }],
        quoteVersion: "123456789012345678901234",
      }),
    );
    expect(setLastCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "POS-1", total: 564.55 }),
    );
    expect(clearMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/success" });
  });

  it("quotes a coupon before adding it to checkout", async () => {
    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "save10" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(quoteMock).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "store-1", couponCode: "SAVE10" }),
      ),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /place order/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() =>
      expect(checkoutMock).toHaveBeenCalledWith(expect.objectContaining({ couponCode: "SAVE10" })),
    );
  });

  it("shows rejected coupon errors without applying the code", async () => {
    quoteMock.mockRejectedValueOnce(new Error("Coupon is not available at this store"));
    render(<CheckoutPage />);

    fireEvent.change(screen.getByLabelText("Coupon code"), { target: { value: "OTHERSTORE" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Coupon is not available at this store",
    );
    fireEvent.click(screen.getByRole("button", { name: /place order/i }));
    await waitFor(() => expect(checkoutMock).toHaveBeenCalledOnce());
    expect(checkoutMock.mock.calls[0][0]).not.toHaveProperty("couponCode");
  });
});
