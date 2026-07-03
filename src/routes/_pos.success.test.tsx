import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptStatus } from "@/lib/receipt";

const navigateMock = vi.fn();
const printReceiptMock = vi.fn().mockResolvedValue(true);
const useCartMock = vi.fn();

vi.mock("@/lib/cart-context", () => ({
  useCart: () => useCartMock(),
}));

vi.mock("@/lib/receipt-print", () => ({
  printNormalizedReceipt: (...args: unknown[]) => printReceiptMock(...args),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a {...props}>{children}</a>
    ),
  };
});

import { SuccessPage } from "./_pos.success";

function buildCheckout(receiptStatus: ReceiptStatus = "generated") {
  return {
    payment: "UPI" as const,
    delivery: "Walk-Out" as const,
    orderId: "ORD-1001",
    orderObjectId: "order-object-1",
    total: 255,
    receiptData: {},
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
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the receipt preview with visible receipt data", () => {
    useCartMock.mockReturnValue({
      lastCheckout: buildCheckout(),
    });

    render(<SuccessPage />);

    expect(screen.getByText("Receipt ready to print")).toBeInTheDocument();
    expect(screen.getByText("CHHOTA BAZAAR")).toBeInTheDocument();
    expect(screen.getByText(/Customer: Neha/)).toBeInTheDocument();
    expect(screen.getByText(/Invoice No: ORD-1001/)).toBeInTheDocument();
  });
});
