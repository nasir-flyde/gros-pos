import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const setCustomerMock = vi.fn();
const createCustomerMock = vi.fn();
const searchCustomersMock = vi.fn();
const getCustomerByIdMock = vi.fn();
const listOrdersMock = vi.fn();

let searchState: { returnTo?: "/new-order" | "/checkout" } = {};
let paramsState: { customerId: string } = { customerId: "customer-1" };
let pathnameState = "/customers";
let queryState = {
  customers: [
    {
      _id: "customer-1",
      name: "Asha Sharma",
      mobile: "9999999999",
      area: "Central",
      pincode: "110001",
      ordersCount: 4,
      totalSpend: 2400,
      status: "active",
      createdAt: "2026-01-01T10:00:00.000Z",
    },
  ],
  detailCustomer: {
    _id: "customer-1",
    name: "Asha Sharma",
    mobile: "9999999999",
    area: "Central",
    pincode: "110001",
    ordersCount: 4,
    totalSpend: 2400,
    status: "active",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  orders: [] as Array<unknown>,
};

vi.mock("@/lib/cart-context", () => ({
  useCart: () => ({
    setCustomer: setCustomerMock,
  }),
}));

vi.mock("@/lib/customer-api", () => ({
  customerApi: {
    search: (...args: unknown[]) => searchCustomersMock(...args),
    create: (...args: unknown[]) => createCustomerMock(...args),
    getById: (...args: unknown[]) => getCustomerByIdMock(...args),
  },
}));

vi.mock("@/lib/order-api", () => ({
  orderApi: {
    list: (...args: unknown[]) => listOrdersMock(...args),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: [string, ...unknown[]] }) => {
    if (queryKey[0] === "pos-customers") {
      return {
        data: { data: queryState.customers },
        isFetching: false,
      };
    }

    if (queryKey[0] === "pos-customer-detail") {
      return {
        data: { data: queryState.detailCustomer },
        isLoading: false,
      };
    }

    if (queryKey[0] === "pos-customer-orders") {
      return {
        data: queryState.orders,
        isLoading: false,
      };
    }

    return {
      data: undefined,
      isFetching: false,
      isLoading: false,
    };
  },
  useMutation: (options: {
    mutationFn: (data: unknown) => unknown;
    onSuccess?: (result: { data: { _id: string; name: string; mobile: string; area?: string } }) => void;
  }) => ({
    isPending: false,
    mutate: (data: unknown) => {
      const result = options.mutationFn(data) as {
        data: { _id: string; name: string; mobile: string; area?: string };
      };
      options.onSuccess?.(result);
    },
  }),
}));

vi.mock("@tanstack/react-router", () => {
  const Link = ({
    children,
    search,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { search?: Record<string, unknown> }) => (
    <a
      {...props}
      data-search={search ? JSON.stringify(search) : ""}
    >
      {children}
    </a>
  );

  return {
    createFileRoute: (_path: string) => (options: Record<string, unknown>) => ({
      ...options,
      useSearch: () => searchState,
      useParams: () => paramsState,
    }),
    Link,
    Outlet: () => <div data-testid="outlet" />,
    useNavigate: () => navigateMock,
    useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname: pathnameState } }),
  };
});

import { CustomerDetailPage } from "./_pos.customers.$customerId";
import { CustomersPage } from "./_pos.customers";

describe("POS customer return flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchState = {};
    paramsState = { customerId: "customer-1" };
    pathnameState = "/customers";
    queryState = {
      customers: [
        {
          _id: "customer-1",
          name: "Asha Sharma",
          mobile: "9999999999",
          area: "Central",
          pincode: "110001",
          ordersCount: 4,
          totalSpend: 2400,
          status: "active",
          createdAt: "2026-01-01T10:00:00.000Z",
        },
      ],
      detailCustomer: {
        _id: "customer-1",
        name: "Asha Sharma",
        mobile: "9999999999",
        area: "Central",
        pincode: "110001",
        ordersCount: 4,
        totalSpend: 2400,
        status: "active",
        createdAt: "2026-01-01T10:00:00.000Z",
      },
      orders: [],
    };
    createCustomerMock.mockImplementation((data) => ({
      data: {
        _id: "customer-2",
        name: (data as { name: string }).name,
        mobile: (data as { mobile: string }).mobile,
        area: (data as { area?: string }).area,
      },
    }));
  });

  it("returns to checkout after selecting a customer from the list", () => {
    searchState = { returnTo: "/checkout" };

    render(<CustomersPage />);

    fireEvent.click(screen.getByRole("button", { name: /select customer/i }));

    expect(setCustomerMock).toHaveBeenCalledWith({
      _id: "customer-1",
      name: "Asha Sharma",
      mobile: "9999999999",
      area: "Central",
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/checkout" });
  });

  it("returns to new order after creating a customer", () => {
    searchState = { returnTo: "/new-order" };

    render(<CustomersPage />);

    fireEvent.click(screen.getByRole("button", { name: /add new customer/i }));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Ramesh Kumar" } });
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/area \/ locality/i), { target: { value: "Karol Bagh" } });
    fireEvent.click(screen.getByRole("button", { name: /save customer/i }));

    expect(createCustomerMock).toHaveBeenCalledWith({
      name: "Ramesh Kumar",
      mobile: "9876543210",
      area: "Karol Bagh",
      pincode: undefined,
    });
    expect(setCustomerMock).toHaveBeenCalledWith({
      _id: "customer-2",
      name: "Ramesh Kumar",
      mobile: "9876543210",
      area: "Karol Bagh",
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/new-order" });
  });

  it("preserves returnTo when linking to the customer detail page", () => {
    searchState = { returnTo: "/checkout" };

    render(<CustomersPage />);

    const viewLink = screen.getByText("View").closest("a");
    expect(viewLink).not.toBeNull();
    expect(viewLink).toHaveAttribute("data-search", JSON.stringify({ returnTo: "/checkout" }));
  });

  it("returns to checkout after selecting a customer from the detail page", () => {
    searchState = { returnTo: "/checkout" };

    render(<CustomerDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: /select customer/i }));

    expect(setCustomerMock).toHaveBeenCalledWith({
      _id: "customer-1",
      name: "Asha Sharma",
      mobile: "9999999999",
      area: "Central",
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/checkout" });
  });

  it("does not use browser history or redirect when returnTo is missing", () => {
    const historyBackSpy = vi.spyOn(window.history, "back");

    render(<CustomersPage />);

    fireEvent.click(screen.getByRole("button", { name: /select customer/i }));

    expect(setCustomerMock).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });
});
