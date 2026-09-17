import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptStatus } from "@/lib/receipt";

const navigateMock = vi.fn();
const printReceiptMock = vi.fn().mockResolvedValue(true);
const printReceiptHtmlMock = vi.fn().mockResolvedValue(true);
const useCartMock = vi.fn();

vi.mock("@/lib/cart-context", () => ({
  useCart: () => useCartMock(),
}));

vi.mock("@/lib/receipt-print", () => ({
  printNormalizedReceipt: (...args: unknown[]) => printReceiptMock(...args),
}));

vi.mock("@/lib/order-receipt", () => ({
  fetchAndPrintOrderReceiptHtml: (...args: unknown[]) => printReceiptHtmlMock(...args),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");

  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a {...props}>{children}</a>
    ),
  };
});

import { Route as SuccessRoute } from "./_pos.success";

const SuccessRouteComponent = SuccessRoute as unknown as {
  component?: ComponentType;
  options?: { component?: ComponentType };
};
const SuccessPage = (SuccessRouteComponent.component ??
  SuccessRouteComponent.options?.component) as ComponentType;

function buildCheckout(receiptStatus: ReceiptStatus = "generated") {
  return {
    payment: "UPI" as const,
    delivery: "Walk-Out" as const,
    orderId: "ORD-1001",
    orderObjectId: "order-object-1",
    total: 255,
    receiptData: { storeInfo: { storeName: "Tenant Store" } },
    receiptStatus,
    receiptWarning: undefined,
    customer: {
      _id: "customer-1",
      name: "Neha",
      mobile: "9999999999",
    },
  };
}

describe("SuccessPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the receipt preview with visible receipt data", () => {
    useCartMock.mockReturnValue({
      lastCheckout: buildCheckout(),
    });

    render(<SuccessPage />);

    expect(screen.getByText("Receipt ready to print")).toBeInTheDocument();
    expect(screen.getByText("Tenant Store")).toBeInTheDocument();
    expect(screen.getByText(/Customer: Neha/)).toBeInTheDocument();
    expect(screen.getByText(/Invoice No: ORD-1001/)).toBeInTheDocument();
  });

  it("uses backend HTML for automatic printing", async () => {
    vi.useFakeTimers();
    useCartMock.mockReturnValue({ lastCheckout: buildCheckout() });

    render(<SuccessPage />);
    await vi.advanceTimersByTimeAsync(800);

    expect(printReceiptHtmlMock).toHaveBeenCalledWith("order-object-1");
    expect(printReceiptMock).not.toHaveBeenCalled();
  });
});
