import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { isSuperAdmin: false },
    permissions: [] as string[],
    scopes: [
      { type: "store", id: "store-1", name: "Main Store" },
      { type: "store", id: "store-2", name: "Second Store" },
    ],
  },
  createBatch: vi.fn(),
  pdf: vi.fn(),
  invalidateQueries: vi.fn(),
  stores: [
    { _id: "store-1", storeName: "Main Store", storeCode: "MAIN" },
    { _id: "store-2", storeName: "Second Store", storeCode: "SECOND" },
  ],
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector(mocks.auth),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/shelf-label-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/shelf-label-api")>("@/lib/shelf-label-api");
  return {
    ...actual,
    shelfLabelApi: {
      stores: vi.fn(),
      candidates: vi.fn(),
      history: vi.fn(),
      createBatch: mocks.createBatch,
      pdf: mocks.pdf,
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: ({
    mutationFn,
    onSuccess,
    onError,
  }: {
    mutationFn: (value?: unknown) => unknown;
    onSuccess?: (value: unknown) => unknown;
    onError?: (error: unknown) => unknown;
  }) => ({
    isPending: false,
    mutate: (value?: unknown) => {
      Promise.resolve(mutationFn(value)).then(onSuccess).catch(onError);
    },
  }),
  useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
    if (queryKey[0] === "shelf-label-stores") {
      return {
        data: mocks.stores,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (queryKey[0] === "shelf-label-candidates") {
      return {
        data: {
          data: [
            {
              productVariantId: "variant-1",
              productName: "Labelled Atta",
              variantName: "5 kg",
              sku: "ATTA-5",
              primaryBarcode: "8901234567890",
              mrp: 300,
              regularPrice: 270,
              effectivePrice: 250,
              savings: 20,
              promotion: null,
              reasons: ["NEW_STOCK"],
              printable: true,
              errors: [],
            },
          ],
          meta: { page: 1, limit: 25, totalDocs: 1, totalPages: 1 },
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return {
      data: { data: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

import { Route as ShelfLabelRoute } from "./_pos.shelf-labels";

const ShelfLabelPage = (
  ShelfLabelRoute as unknown as {
    component?: ComponentType;
    options?: { component?: ComponentType };
  }
).component!;

describe("POS SEL Printing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { isSuperAdmin: false };
    mocks.auth.permissions = ["shelfLabel.read"];
    mocks.auth.scopes = [
      { type: "store", id: "store-1", name: "Main Store" },
      { type: "store", id: "store-2", name: "Second Store" },
    ];
    mocks.stores = [
      { _id: "store-1", storeName: "Main Store", storeCode: "MAIN" },
      { _id: "store-2", storeName: "Second Store", storeCode: "SECOND" },
    ];
  });

  it("denies direct access without shelf-label permission", () => {
    mocks.auth.permissions = ["product.read"];
    render(<ShelfLabelPage />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByLabelText("Assigned store")).not.toBeInTheDocument();
  });

  it("offers only the assigned stores returned for the user", () => {
    render(<ShelfLabelPage />);

    const store = screen.getByLabelText("Assigned store");
    expect(store).toHaveTextContent("Main Store (MAIN)");
    expect(store).toHaveTextContent("Second Store (SECOND)");
  });

  it("automatically selects the only assigned store", async () => {
    mocks.stores = [{ _id: "store-1", storeName: "Main Store", storeCode: "MAIN" }];
    render(<ShelfLabelPage />);

    await waitFor(() => expect(screen.getByLabelText("Assigned store")).toHaveValue("store-1"));
    expect(screen.getByText("Labelled Atta")).toBeInTheDocument();
  });

  it("lets read-only users inspect products but not select or generate labels", () => {
    render(<ShelfLabelPage />);
    fireEvent.change(screen.getByLabelText("Assigned store"), { target: { value: "store-1" } });

    expect(screen.getByText("Labelled Atta")).toBeInTheDocument();
    expect(screen.getByLabelText("Select ATTA-5")).toBeDisabled();
    expect(screen.getByRole("button", { name: /generate preview/i })).toBeDisabled();
  });

  it("selects a product, clamps copies to 500, and creates a scoped batch", async () => {
    mocks.auth.permissions = ["shelfLabel.print"];
    mocks.createBatch.mockResolvedValue({
      data: {
        _id: "batch-1",
        batchNumber: "SEL-1",
        storeId: "store-1",
        storeSnapshot: { storeName: "Main Store", storeCode: "MAIN" },
        layout: "THERMAL_50X30",
        totalLabels: 500,
        generatedAt: "2026-09-07T10:00:00.000Z",
        createdAt: "2026-09-07T10:00:00.000Z",
      },
    });
    mocks.pdf.mockResolvedValue(new Blob(["pdf"]));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:label"),
      revokeObjectURL: vi.fn(),
    });

    render(<ShelfLabelPage />);
    fireEvent.change(screen.getByLabelText("Assigned store"), { target: { value: "store-1" } });
    fireEvent.click(screen.getByLabelText("Select ATTA-5"));
    fireEvent.change(screen.getByLabelText("Copies for ATTA-5"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /generate preview/i }));

    await waitFor(() =>
      expect(mocks.createBatch).toHaveBeenCalledWith({
        storeId: "store-1",
        layout: "THERMAL_50X30",
        items: [{ productVariantId: "variant-1", quantity: 500 }],
      }),
    );
  });
});
