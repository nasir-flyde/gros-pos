import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PosVariant } from "@/lib/product-api";

const addMock = vi.fn();
const incMock = vi.fn();
const decMock = vi.fn();
const refetchMock = vi.fn();

let cartItems: Array<{ product: { _id: string; quantityAvailable?: number }; qty: number }> = [];
let queryMode: "success" | "missing" = "success";
let keepStaleLookupData = false;
let lastLookupData: { variant: PosVariant; markdown: null } | undefined;

const variant: PosVariant = {
  _id: "variant-1",
  productId: "product-1",
  sku: "ATTA-5",
  variantName: "Atta 5kg",
  sellingMode: "FIXED",
  unitType: "kg",
  unitValue: "5",
  mrp: 320,
  pricePerUnit: 299,
  barcodes: [{ code: "890100", type: "EAN", isPrimary: true }],
  images: [],
  active: true,
  taxRate: 5,
  quantityAvailable: 2,
};

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: { scopes: Array<{ type: "store"; id: string }> }) => unknown) =>
    selector({ scopes: [{ type: "store", id: "store-1" }] }),
}));

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    add: addMock,
    inc: incMock,
    dec: decMock,
    items: cartItems,
    count: cartItems.length,
    activeOrderId: null,
  }),
}));

vi.mock("@/components/CartPanel", () => ({
  CartPanel: () => <aside data-testid="cart-panel" />,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: [string, string] }) => {
    const barcode = queryKey[1] ?? "";
    const active = barcode.length >= 6;
    if (active && queryMode === "success") {
      lastLookupData = { variant, markdown: null };
    }
    return {
      data:
        active && queryMode === "success"
          ? lastLookupData
          : keepStaleLookupData
            ? lastLookupData
            : undefined,
      isFetching: false,
      error: active && queryMode === "missing" ? new Error("Not found") : null,
      refetch: refetchMock,
    };
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Route as ScannerRoute } from "./_pos.scanner";

const ScannerPage = (
  ScannerRoute as unknown as { component?: ComponentType; options?: { component?: ComponentType } }
).component!;

describe("Scanner production states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addMock.mockReturnValue(true);
    cartItems = [];
    queryMode = "success";
    keepStaleLookupData = false;
    lastLookupData = undefined;
  });

  it("adds a manually looked-up barcode to the cart", async () => {
    render(<ScannerPage />);

    fireEvent.change(screen.getByRole("textbox", { name: /barcode/i }), {
      target: { value: "890100" },
    });

    await waitFor(() => expect(addMock).toHaveBeenCalledOnce());
    expect(addMock.mock.calls[0][0]).toMatchObject({ _id: "variant-1", name: "Atta 5kg" });
  });

  it("clears the lookup view so another barcode can be searched after auto-add", async () => {
    keepStaleLookupData = true;

    render(<ScannerPage />);

    const input = screen.getByRole("textbox", { name: /barcode/i });
    fireEvent.change(input, { target: { value: "890100" } });

    await waitFor(() => expect(addMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("textbox", { name: /barcode/i })).toHaveValue(""));
    expect(screen.getByRole("textbox", { name: /barcode/i })).toHaveFocus();
    expect(screen.queryByText("Atta 5kg")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /barcode/i }), {
      target: { value: "890101" },
    });
    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(2));
  });

  it("shows product-not-found with retry for manual lookup failures", () => {
    queryMode = "missing";

    render(<ScannerPage />);

    fireEvent.change(screen.getByRole("textbox", { name: /barcode/i }), {
      target: { value: "890404" },
    });

    expect(screen.getByText("Product not found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry lookup/i }));
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it("shows camera permission failures without blocking manual entry", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
      },
    });

    render(<ScannerPage />);

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(await screen.findByText(/camera permission denied/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /barcode/i })).toBeInTheDocument();
  });
});
