import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PosJoinedVariant } from "@/lib/product-api";

const addMock = vi.fn();
const refetchMock = vi.fn();

let catalogState = {
  data: {
    categories: [{ _id: "cat-1", categoryCode: "C1", name: "Staples", slug: "staples" }],
    variants: [] as PosJoinedVariant[],
  },
  isLoading: false,
  isError: false,
  error: null as Error | null,
};
let cartItems: Array<{ product: { _id: string; quantityAvailable?: number }; qty: number }> = [];

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: { scopes: Array<{ type: "store"; id: string }> }) => unknown) =>
    selector({ scopes: [{ type: "store", id: "store-1" }] }),
}));

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    add: addMock,
    items: cartItems,
  }),
}));

vi.mock("@/components/CartPanel", () => ({
  CartPanel: () => <aside data-testid="cart-panel" />,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    ...catalogState,
    refetch: refetchMock,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

import { Route as NewOrderRoute } from "./_pos.new-order";

const NewOrderPage = (
  NewOrderRoute as unknown as { component?: ComponentType; options?: { component?: ComponentType } }
).component!;

const atta: PosJoinedVariant = {
  _id: "variant-1",
  variantName: "Atta 5kg",
  productName: "Whole Wheat Atta",
  brandName: "Fresh Mill",
  categoryName: "Staples",
  categoryId: "cat-1",
  sku: "ATTA-5",
  sellingMode: "FIXED",
  unitValue: "5",
  unitType: "kg",
  mrp: 320,
  price: 299,
  barcode: "890100",
  barcodes: ["890100"],
  taxRate: 5,
  quantityAvailable: 2,
};

const looseRice: PosJoinedVariant = {
  ...atta,
  _id: "weighted-1",
  variantName: "Loose Rice",
  productName: "Loose Rice",
  sku: "LOOSE-RICE",
  sellingMode: "WEIGHT",
  unitValue: "",
  unitType: "KG",
  mrp: 0,
  price: 120,
  barcode: "890300",
  barcodes: ["890300"],
  quantityAvailable: 10,
};

const rice: PosJoinedVariant = {
  ...atta,
  _id: "variant-2",
  variantName: "Basmati Rice 1kg",
  productName: "Basmati Rice",
  sku: "RICE-1",
  barcode: "890200",
  barcodes: ["890200"],
};

describe("New Order production states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addMock.mockReturnValue(true);
    cartItems = [];
    catalogState = {
      data: {
        categories: [{ _id: "cat-1", categoryCode: "C1", name: "Staples", slug: "staples" }],
        variants: [atta, rice],
      },
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("renders catalog results and filters by search", () => {
    render(<NewOrderPage />);

    expect(screen.getByRole("button", { name: /add atta 5kg/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search product/i), {
      target: { value: "rice" },
    });

    expect(screen.queryByRole("button", { name: /add atta 5kg/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add basmati rice 1kg/i })).toBeInTheDocument();
  });

  it("opens weight entry and adds normalized KG for a weighted product", () => {
    catalogState.data.variants = [looseRice];
    render(<NewOrderPage />);

    fireEvent.click(screen.getByRole("button", { name: /add loose rice/i }));
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "250g" } });
    expect(screen.getByText("₹30.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "weighted-1", sellingMode: "WEIGHT", unitType: "KG" }),
      0.25,
      "250g",
    );
  });

  it("shows a retryable catalog failure", () => {
    catalogState = {
      data: { categories: [], variants: [] },
      isLoading: false,
      isError: true,
      error: new Error("Catalog offline"),
    };

    render(<NewOrderPage />);

    expect(screen.getByText("Products unavailable")).toBeInTheDocument();
    expect(screen.getByText("Catalog offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry products/i }));
    expect(refetchMock).toHaveBeenCalledTimes(2);
  });

  it("disables adding when cart has reached available stock", () => {
    cartItems = [{ product: { _id: "variant-1", quantityAvailable: 2 }, qty: 2 }];

    render(<NewOrderPage />);

    expect(screen.getByRole("button", { name: /add atta 5kg/i })).toBeDisabled();
    expect(screen.getByText("MAX IN CART")).toBeInTheDocument();
  });
});
