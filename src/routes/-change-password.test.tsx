import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";
const mocks = vi.hoisted(() => ({ post: vi.fn(), refresh: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { post: mocks.post } }));
vi.mock("@/lib/auth-access-context", () => ({
  useAuthAccess: () => ({ refreshAccess: mocks.refresh }),
}));
vi.mock("@clerk/react", () => ({ useAuth: () => ({ isSignedIn: true, signOut: vi.fn() }) }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));
import { Route } from "./change-password";
const Page = Route.options.component as ComponentType;
function submit() {
  fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
    target: { value: "Test-password1!" },
  });
  fireEvent.change(screen.getByPlaceholderText("Repeat your password"), {
    target: { value: "Test-password1!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
}
describe("password setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearGrosAccess();
    mocks.post.mockResolvedValue({});
    mocks.refresh.mockResolvedValue(undefined);
  });
  it("saves through the Gros endpoint then uses guarded access refresh", async () => {
    render(<Page />);
    submit();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith("/auth/setup-password", {
      newPassword: "Test-password1!",
    });
  });
  it("does not refresh access after the password page has unmounted", async () => {
    let finish!: () => void;
    mocks.post.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(<Page />);
    submit();
    view.unmount();
    finish();
    await Promise.resolve();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
