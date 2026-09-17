import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth-store";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  clearQueries: vi.fn(),
  getToken: vi.fn(),
  navigate: vi.fn(),
  setTokenGetter: vi.fn(),
  signOut: vi.fn(),
  consoleError: vi.spyOn(console, "error").mockImplementation(() => undefined),
  pathname: "/",
  auth: {
    isLoaded: true,
    isSignedIn: true,
    orgId: "org-1",
    userId: "clerk-user-1",
    sessionId: "session-1",
  },
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({
    ...mocks.auth,
    getToken: mocks.getToken,
    signOut: mocks.signOut,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => queryClient,
}));
const queryClient = { clear: mocks.clearQueries };

vi.mock("@/lib/pos-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pos-config")>()),
  loadPublicPosConfig: vi.fn(),
  loadProtectedPosConfig: vi.fn(),
  clearProtectedPosConfig: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => mocks.apiGet(...args) },
  setClerkTokenGetter: (...args: unknown[]) => mocks.setTokenGetter(...args),
}));

import { AuthProvider } from "./auth-provider";

const accessResponse = {
  data: {
    user: {
      _id: "user-1",
      firstName: "Asha",
      lastName: "Sharma",
      email: "asha@example.com",
      phone: "9999999999",
      isSuperAdmin: false,
      organizationId: "org-1",
    },
    permissions: ["pos.checkout"],
    scopes: [{ type: "store" as const, id: "store-1", name: "Main Store" }],
  },
};

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consoleError.mockClear();
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = true;
    mocks.auth.orgId = "org-1";
    mocks.pathname = "/";
    mocks.apiGet.mockResolvedValue(accessResponse);
    useAuthStore.getState().clearGrosAccess();
  });

  it("loads access and renders authenticated content", async () => {
    render(
      <AuthProvider>
        <div>Authenticated home</div>
      </AuthProvider>,
    );

    expect(screen.getByText("Verifying session...")).toBeInTheDocument();
    expect(await screen.findByText("Authenticated home")).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({
      status: "ready",
      permissions: ["pos.checkout"],
      scopes: [{ type: "store", id: "store-1", name: "Main Store" }],
    });
  });

  it("shows a linked-account error returned by the backend", async () => {
    mocks.apiGet.mockRejectedValue({
      code: "NO_LOCAL_ACCOUNT",
      message: "Ask an administrator to link this login.",
    });

    render(<AuthProvider>Authenticated home</AuthProvider>);

    expect(await screen.findByText("Account not linked")).toBeInTheDocument();
    expect(screen.getByText("Ask an administrator to link this login.")).toBeInTheDocument();
  });

  it("recovers from a generic access failure when Retry succeeds", async () => {
    mocks.apiGet
      .mockRejectedValueOnce({ code: "NETWORK_ERROR", message: "Backend unavailable" })
      .mockResolvedValueOnce(accessResponse);

    render(<AuthProvider>Authenticated home</AuthProvider>);

    expect(await screen.findByText("Session unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Authenticated home")).toBeInTheDocument();
    expect(mocks.apiGet).toHaveBeenCalledTimes(2);
  });

  it("treats a malformed access response as recoverable", async () => {
    mocks.apiGet.mockResolvedValue({ data: { permissions: [], scopes: [] } });

    render(<AuthProvider>Authenticated home</AuthProvider>);

    expect(await screen.findByText("Session unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("The access service returned an invalid response."),
    ).toBeInTheDocument();
  });

  it("ignores an in-flight response after sign-out", async () => {
    let resolveRequest: (value: typeof accessResponse) => void = () => undefined;
    mocks.apiGet.mockReturnValue(
      new Promise<typeof accessResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const view = render(<AuthProvider>Authenticated home</AuthProvider>);
    mocks.auth.isSignedIn = false;
    view.rerender(<AuthProvider>Authenticated home</AuthProvider>);
    resolveRequest(accessResponse);

    await waitFor(() => expect(useAuthStore.getState().status).toBe("unresolved"));
    expect(useAuthStore.getState().user).toBeNull();
    expect(screen.queryByText("Authenticated home")).not.toBeInTheDocument();
  });

  it("ignores an access response from the previous organization", async () => {
    let resolveOld!: (value: typeof accessResponse) => void;
    mocks.apiGet.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const view = render(<AuthProvider>Authenticated home</AuthProvider>);
    mocks.auth.orgId = "org-2";
    mocks.apiGet.mockResolvedValue({
      data: {
        ...accessResponse.data,
        user: { ...accessResponse.data.user, organizationId: "org-2" },
      },
    });
    view.rerender(<AuthProvider>Authenticated home</AuthProvider>);
    await waitFor(() => expect(useAuthStore.getState().user?.organizationId).toBe("org-2"));
    resolveOld(accessResponse);
    await waitFor(() => expect(useAuthStore.getState().user?.organizationId).toBe("org-2"));
  });

  it("requires password setup before entering POS", async () => {
    mocks.apiGet.mockResolvedValue({
      data: {
        ...accessResponse.data,
        user: { ...accessResponse.data.user, mustChangePassword: true },
      },
    });
    render(<AuthProvider>Authenticated home</AuthProvider>);
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/change-password", replace: true }),
    );
  });

  it("redirects signed-out users to login", async () => {
    mocks.auth.isSignedIn = false;

    render(<AuthProvider>Protected content</AuthProvider>);

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login", replace: true }),
    );
  });

  it("redirects authenticated users away from login", async () => {
    mocks.pathname = "/login";

    render(<AuthProvider>Login page</AuthProvider>);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/", replace: true }));
  });
});
