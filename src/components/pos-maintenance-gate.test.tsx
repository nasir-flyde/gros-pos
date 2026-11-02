import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { posMaintenanceAccess } from "@/lib/pos-maintenance";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get: mocks.get } }));
import { PosMaintenanceGate } from "./pos-maintenance-gate";
const enabled = { enabled: true, canManage: false, canBypass: false, updatedAt: null };
beforeEach(() => {
  vi.useFakeTimers();
  mocks.get.mockReset();
  posMaintenanceAccess.reset();
});
afterEach(() => vi.useRealTimers());
test("pause unmounts pages, clears queries, keeps cart, and bounded status polling reopens", async () => {
  const client = new QueryClient();
  client.setQueryData(["private"], "cached business");
  sessionStorage.setItem("pos_active_cart", "kept cart");
  mocks.get.mockResolvedValue({ data: enabled });
  render(
    <QueryClientProvider client={client}>
      <PosMaintenanceGate onSignOut={() => {}}>Business page</PosMaintenanceGate>
    </QueryClientProvider>,
  );
  expect(screen.queryByText("Business page")).not.toBeInTheDocument();
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText("Business page")).toBeInTheDocument();
  act(() => posMaintenanceAccess.receivePausedResponse());
  expect(screen.getByText("Could Not Load Information")).toBeInTheDocument();
  expect(screen.queryByText("Business page")).not.toBeInTheDocument();
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(sessionStorage.getItem("pos_active_cart")).toBe("kept cart");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Business page")).toBeInTheDocument();
});
