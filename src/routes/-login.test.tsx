import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePosConfig } from "@/lib/pos-config";
vi.mock("@clerk/react", () => ({
  SignIn: () => (
    <div role="form" aria-label="Mock Clerk sign in">
      Sign in
    </div>
  ),
}));
import { Route } from "./login";
const Login = Route.options.component as ComponentType;
describe("tenant login smoke", () => {
  it("shows tenant branding around the mocked sign-in boundary", () => {
    usePosConfig.getState().setConfig({
      organizationName: "Gros Test Tenant",
      loginHeading: "Tenant Terminal",
      loginSubtitle: "Sign in to your store",
      supportText: "Contact store manager",
    });
    render(<Login />);
    expect(screen.getByText("Tenant Terminal")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Mock Clerk sign in" })).toBeInTheDocument();
    expect(screen.getByText("Contact store manager")).toBeInTheDocument();
  });
});
