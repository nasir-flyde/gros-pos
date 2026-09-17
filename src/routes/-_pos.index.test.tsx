import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refetches = {
  summary: vi.fn(),
  recent: vi.fn(),
  queue: vi.fn(),
  inventory: vi.fn(),
};

let failingKey: string | null = null;

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
      user: { firstName: "Asha", lastName: "Cashier" },
    }),
}));

vi.mock("@/lib/order-receipt", () => ({
  fetchAndPrintOrderReceipt: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
    const key = queryKey[0];
    const isError = failingKey === key;
    const common = {
      isLoading: false,
      isFetching: false,
      isError,
      error: isError ? new Error(`${key} failed`) : null,
    };

    if (key === "order-summary") {
      return {
        ...common,
        data: isError
          ? undefined
          : { data: { revenue: 1000, completedOrders: 2, averageOrderValue: 500 } },
        refetch: refetches.summary,
      };
    }
    if (key === "recent-orders") {
      return {
        ...common,
        data: { data: [] },
        refetch: refetches.recent,
      };
    }
    if (key === "homepage-fulfillment-queue") {
      return {
        ...common,
        data: { data: [] },
        refetch: refetches.queue,
      };
    }
    return {
      ...common,
      data: isError ? undefined : { variants: [], categories: [] },
      refetch: refetches.inventory,
    };
  },
}));

import { Route as HomeRoute } from "./_pos.index";

const HomePage = (
  HomeRoute as unknown as { component?: ComponentType; options?: { component?: ComponentType } }
).component!;

describe("Home production states", () => {
  beforeEach(() => {
    failingKey = null;
    Object.values(refetches).forEach((fn) => fn.mockClear());
  });

  it("keeps the dashboard usable when one section fails", () => {
    failingKey = "pos-catalog";

    render(<HomePage />);

    expect(screen.getByText("Main Store · Asha Cashier")).toBeInTheDocument();
    expect(screen.getByText(/pos-catalog failed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetches.inventory).toHaveBeenCalledTimes(2);
  });
});
