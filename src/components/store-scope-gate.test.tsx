import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";

const mocks = vi.hoisted(() => ({
  refreshAccess: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));

vi.mock("@/lib/auth-access-context", () => ({
  useAuthAccess: () => ({ refreshAccess: mocks.refreshAccess }),
}));

import { StoreScopeGate } from "./store-scope-gate";

const user = {
  id: "user-1",
  firstName: "Asha",
  lastName: "Sharma",
  email: "asha@example.com",
  phone: "9999999999",
  isSuperAdmin: false,
};

describe("StoreScopeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setGrosAccess({ user, permissions: [], scopes: [] });
  });

  it("renders POS content for a valid store scope", () => {
    useAuthStore.getState().setGrosAccess({
      user,
      permissions: [],
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
    });

    render(<StoreScopeGate>POS content</StoreScopeGate>);

    expect(screen.getByText("POS content")).toBeInTheDocument();
  });

  it("blocks POS content and offers retry and sign out without a store", () => {
    render(<StoreScopeGate>POS content</StoreScopeGate>);

    expect(screen.getByText("No store assigned")).toBeInTheDocument();
    expect(screen.queryByText("POS content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Retry access"));
    fireEvent.click(screen.getByText("Sign out"));

    expect(mocks.refreshAccess).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("unlocks POS content after refreshed access receives a store", async () => {
    mocks.refreshAccess.mockImplementation(async () => {
      useAuthStore.getState().setGrosAccess({
        user,
        permissions: [],
        scopes: [{ type: "store", id: "store-2", name: "Assigned Store" }],
      });
    });

    render(<StoreScopeGate>POS content</StoreScopeGate>);
    fireEvent.click(screen.getByText("Retry access"));

    expect(await screen.findByText("POS content")).toBeInTheDocument();
    await waitFor(() => expect(mocks.refreshAccess).toHaveBeenCalledOnce());
  });

  it("does not let super-admin status bypass the store requirement", () => {
    useAuthStore.getState().setGrosAccess({
      user: { ...user, isSuperAdmin: true },
      permissions: [],
      scopes: [],
    });

    render(<StoreScopeGate>POS content</StoreScopeGate>);

    expect(screen.getByText("No store assigned")).toBeInTheDocument();
  });
});
