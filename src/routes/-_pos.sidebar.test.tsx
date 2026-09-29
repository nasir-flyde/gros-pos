import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Outlet: () => null,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: () => "/",
  useNavigate: () => vi.fn(),
}));

import { SideNav } from "./_pos";

const baseUser = {
  id: "user-1",
  firstName: "Asha",
  lastName: "Cashier",
  email: "asha@example.com",
  phone: "9999999999",
  isSuperAdmin: false,
};

describe("POS sidebar SEL access", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: baseUser, permissions: [], scopes: [] });
  });

  it.each([["shelfLabel.read"], ["shelfLabel.print"]])(
    "shows SEL Printing with %s",
    (permission) => {
      useAuthStore.setState({ permissions: [permission] });
      render(<SideNav />);

      expect(screen.getByRole("link", { name: /sel printing/i })).toHaveAttribute(
        "href",
        "/shelf-labels",
      );
    },
  );

  it("hides SEL Printing without shelf-label access", () => {
    useAuthStore.setState({ permissions: ["product.read"] });
    render(<SideNav />);

    expect(screen.queryByRole("link", { name: /sel printing/i })).not.toBeInTheDocument();
  });

  it("shows SEL Printing for a super admin", () => {
    useAuthStore.setState({ user: { ...baseUser, isSuperAdmin: true } });
    render(<SideNav />);

    expect(screen.getByRole("link", { name: /sel printing/i })).toBeInTheDocument();
  });

  it("always shows the Markdown portal entry", () => {
    render(<SideNav />);
    expect(screen.getByRole("link", { name: /markdown/i })).toHaveAttribute(
      "href",
      "/markdown-damage",
    );
  });
});
