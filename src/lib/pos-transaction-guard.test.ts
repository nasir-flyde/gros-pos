import { beforeEach, expect, test } from "vitest";
import axios from "axios";
import { PosMaintenanceAccess } from "./pos-maintenance";
import { createPosApi } from "./create-pos-api";
import {
  setPosSessionOwner,
  getPendingPosTransaction,
  acknowledgePosTransaction,
} from "./pos-transaction-guard";
const enabled = { enabled: true, canManage: false, canBypass: false, updatedAt: null };
beforeEach(() => {
  sessionStorage.clear();
  setPosSessionOwner("fixture-user");
});
function client() {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  return {
    access,
    api: createPosApi({
      baseURL: "http://fixture.invalid/api/v1",
      access,
      getToken: async () => "fixture",
      getOrganizationId: () => null,
      onSessionExpired: () => undefined,
    }),
  };
}
test("pause cancels admitted checkout, persists ambiguity across reload and prevents a second dispatch", async () => {
  const { access, api } = client();
  let calls = 0;
  api.defaults.adapter = (config) =>
    new Promise((_resolve, reject) => {
      calls++;
      expect(config.headers["Idempotency-Key"]).toBeTruthy();
      config.signal?.addEventListener?.("abort", () =>
        reject(
          Object.assign(new axios.AxiosError("fixture abort", "ERR_CANCELED", config), {
            __CANCEL__: true,
          }),
        ),
      );
    });
  const work = api.post("/pos/checkout", { fixture: true });
  // Attach rejection handler before aborting to avoid an unhandled promise.
  const failure = expect(work).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  access.receivePausedResponse();
  await failure;
  expect(getPendingPosTransaction()?.phase).toBe("uncertain");
  setPosSessionOwner("fixture-user");
  access.applySavedStatus(enabled);
  await expect(api.post("/pos/checkout", { fixture: true })).rejects.toMatchObject({
    code: "POS_TRANSACTION_UNRESOLVED",
  });
  await expect(api.post("/pos/paytm/request", { fixture: true })).rejects.toMatchObject({
    code: "POS_TRANSACTION_UNRESOLVED",
  });
  expect(calls).toBe(1);
  acknowledgePosTransaction();
  expect(getPendingPosTransaction()).toBeNull();
});
test("a definite server rejection clears the guard and successful checkout completes normally", async () => {
  const { access, api } = client();
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError("paused", undefined, config, undefined, {
      config,
      status: 503,
      statusText: "",
      headers: {},
      data: { code: "POS_PAUSED" },
    });
  };
  await expect(api.post("/pos/checkout", {})).rejects.toMatchObject({ code: "POS_PAUSED" });
  expect(getPendingPosTransaction()).toBeNull();
  access.applySavedStatus(enabled);
  api.defaults.adapter = async (config) => ({
    config,
    status: 201,
    statusText: "",
    headers: {},
    data: { data: { order: { _id: "fixture-order" } } },
  });
  await expect(api.post("/pos/checkout", {})).resolves.toMatchObject({
    data: { order: { _id: "fixture-order" } },
  });
  expect(getPendingPosTransaction()).toBeNull();
});
test("accepted payment survives pause/reload and status resolution clears its guard", async () => {
  const { access, api } = client();
  api.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: "",
    headers: {},
    data: {
      data: config.url?.endsWith("/request")
        ? { paymentTransactionId: "payment-fixture" }
        : { status: "COMPLETED" },
    },
  });
  await api.post("/pos/paytm/request", {});
  access.receivePausedResponse();
  setPosSessionOwner("fixture-user");
  expect(getPendingPosTransaction()).toMatchObject({
    phase: "payment",
    paymentId: "payment-fixture",
  });
  access.applySavedStatus(enabled);
  await expect(api.post("/pos/checkout", {})).rejects.toMatchObject({
    code: "POS_TRANSACTION_UNRESOLVED",
  });
  await api.get("/pos/paytm/payments/payment-fixture/status");
  expect(getPendingPosTransaction()).toBeNull();
});
test("account change clears cart and receipt but does not expose another account transaction", async () => {
  const { api } = client();
  api.defaults.adapter = async (config) => {
    throw new axios.AxiosError("offline", "ERR_NETWORK", config);
  };
  await expect(api.post("/pos/checkout", {})).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  sessionStorage.setItem("pos_active_cart", "previous cart");
  sessionStorage.setItem("pos_last_checkout", "previous receipt");
  setPosSessionOwner("next-user");
  expect(getPendingPosTransaction()).toBeNull();
  expect(sessionStorage.getItem("pos_active_cart")).toBeNull();
  expect(sessionStorage.getItem("pos_last_checkout")).toBeNull();
  setPosSessionOwner("fixture-user");
  expect(getPendingPosTransaction()?.phase).toBe("uncertain");
});
