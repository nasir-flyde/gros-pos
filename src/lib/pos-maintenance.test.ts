import { test } from "vitest";
import assert from "node:assert/strict";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import {
  PosMaintenanceAccess,
  posApiPath,
  isMaintenanceControlRequest,
  parseMaintenanceStatus,
  type PosMaintenanceStatus,
} from "./pos-maintenance.ts";
import { createPosApi } from "./create-pos-api.ts";
import { isPosAccessError } from "./pos-maintenance";
const shouldRetryQuery = (count: number, error: unknown) => !isPosAccessError(error) && count < 3;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

const enabled: PosMaintenanceStatus = {
  enabled: true,
  canBypass: false,
  canManage: false,
  updatedAt: null,
};
const paused = { ...enabled, enabled: false };
const createClient = (access: PosMaintenanceAccess, getToken = async () => "fixture-session") =>
  createPosApi({
    baseURL: "http://fixture.invalid/api/v1",
    access,
    getToken,
    getOrganizationId: () => "fixture-org",
    onSessionExpired: () => undefined,
  });
const response = (config: InternalAxiosRequestConfig, data = { success: true, data: [] }) => ({
  config,
  data,
  status: 200,
  statusText: "OK",
  headers: {},
});
const apiFailure = (config: InternalAxiosRequestConfig, code: string, status = 503) =>
  new AxiosError("fixture failure", undefined, config, undefined, {
    ...response(config),
    status,
    data: { success: false, code, message: "fixture failure" },
  });

test("startup/reload/direct-route traffic stays blocked until authoritative status; only minimal control requests reach adapter", async () => {
  const access = new PosMaintenanceAccess();
  const client = createClient(access);
  const requests: string[] = [];
  client.defaults.adapter = async (config) => {
    requests.push(config.url!);
    return response(config);
  };
  for (const path of ["/reports", "/products/fixture", "/inventory/conversions", "/pos/orders"])
    await assert.rejects(client.get(path), { code: "POS_ACCESS_PENDING" });
  await client.get("/auth/me");
  await client.get("/pos/maintenance");
  assert.deepEqual(requests, ["/auth/me", "/pos/maintenance"]);
  await access.checkStatus(async () => paused);
  await assert.rejects(client.get("/reports"), { code: "POS_PAUSED" });
  assert.equal(requests.length, 2);
  assert.equal(new PosMaintenanceAccess().canUsePos(), false);
});

test("enabled requests use the protected namespace, token and original tenant header", async () => {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  const client = createClient(access);
  client.defaults.adapter = async (config) => {
    assert.equal(config.url, "/pos/reports?limit=20");
    assert.equal(config.headers.Authorization, "Bearer fixture-session");
    assert.equal(config.headers["X-Organization-Id"], "selected-org");
    return response(config);
  };
  await client.get("/reports?limit=20", { headers: { "X-Organization-Id": "selected-org" } });
  assert.equal(posApiPath("/pos/products"), "/pos/products");
  assert.equal(posApiPath("/auth/setup-password"), "/auth/setup-password");
  for (const path of ["https://other.invalid/api", "//other.invalid", "/pos/../admin"])
    assert.throws(() => posApiPath(path));
  assert.equal(isMaintenanceControlRequest("/auth/me", "post"), false);
  assert.equal(isMaintenanceControlRequest("/pos/maintenance/extra"), false);
  assert.equal(isMaintenanceControlRequest("/pos/maintenance?bypass=1"), false);
});

test("approved status permits normal use while paused; frontend never infers bypass from a client email", async () => {
  for (const account of ["nasir", "samarth"]) {
    const access = new PosMaintenanceAccess();
    await access.checkStatus(async () => ({ ...paused, canBypass: true, canManage: true }));
    const client = createClient(access);
    let calls = 0;
    client.defaults.adapter = async (config) => {
      calls++;
      return response(config);
    };
    await client.get("/reports");
    assert.equal(calls, 1, account);
    assert.equal(access.getSnapshot().status?.canManage, true);
  }
  assert.throws(() => parseMaintenanceStatus({ enabled: false, email: "nasir@flyde.in" }));
});

test("active → paused cancels in-flight normal requests and caller cancellation also propagates", async () => {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  const started = deferred<void>();
  const client = createClient(access);
  client.defaults.adapter = (config) =>
    new Promise((_, reject) => {
      config.signal!.addEventListener!("abort", () =>
        reject(new axios.CanceledError("aborted", undefined, config)),
      );
      started.resolve();
    });
  const work = client.get("/reports");
  await started.promise;
  access.receivePausedResponse();
  await assert.rejects(work, { code: "REQUEST_CANCELLED" });
  access.applySavedStatus(enabled);
  const upstream = new AbortController();
  const lease = access.acquireRequest(upstream.signal);
  upstream.abort();
  assert.equal(lease.signal.aborted, true);
  lease.release();
  const lease2 = access.acquireRequest();
  access.reset();
  assert.equal(lease2.signal.aborted, true);
  lease2.release();
});

test("pause while Clerk token is pending prevents dispatch", async () => {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  const token = deferred<string>();
  const started = deferred<void>();
  const client = createClient(access, () => {
    started.resolve();
    return token.promise;
  });
  let calls = 0;
  client.defaults.adapter = async (config) => {
    calls++;
    return response(config);
  };
  const work = client.get("/products");
  await started.promise;
  access.receivePausedResponse();
  token.resolve("fixture-session");
  await assert.rejects(work, { code: "POS_PAUSED" });
  assert.equal(calls, 0);
});

test("only explicit POS_PAUSED response closes access; ordinary errors retain ordinary API handling", async () => {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  const client = createClient(access);
  for (const code of ["INTERNAL_ERROR", "NETWORK_ERROR", "FORBIDDEN"]) {
    client.defaults.adapter = async (config) => {
      throw apiFailure(config, code);
    };
    await assert.rejects(client.get("/reports"), { code });
    assert.equal(access.canUsePos(), true);
  }
  client.defaults.adapter = async (config) => {
    throw apiFailure(config, "POS_PAUSED");
  };
  await assert.rejects(client.get("/reports"), { code: "POS_PAUSED" });
  assert.equal(access.canUsePos(), false);
});

test("paused queries never retry 503; queued requests cannot reach adapter; explicit status read resumes", async () => {
  const access = new PosMaintenanceAccess();
  access.applySavedStatus(enabled);
  const client = createClient(access);
  let calls = 0;
  client.defaults.adapter = async (config) => {
    calls++;
    throw apiFailure(config, "POS_PAUSED");
  };
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => access.canUsePos() && shouldRetryQuery(count, error),
        retryDelay: 0,
      },
    },
  });
  await assert.rejects(
    queryClient.fetchQuery({ queryKey: ["reports"], queryFn: () => client.get("/reports") }),
    { code: "POS_PAUSED" },
  );
  assert.equal(calls, 1);
  for (const code of ["POS_PAUSED", "POS_ACCESS_PENDING", "REQUEST_CANCELLED"])
    assert.equal(shouldRetryQuery(0, { code, status: 503 }), false);
  await assert.rejects(
    queryClient.fetchQuery({ queryKey: ["products"], queryFn: () => client.get("/products") }),
    { code: "POS_PAUSED" },
  );
  assert.equal(calls, 1);
  await access.checkStatus(async () => enabled, Date.now() + 60_000);
  client.defaults.adapter = async (config) => {
    calls++;
    return response(config);
  };
  await client.get("/reports");
  assert.equal(calls, 2);
  queryClient.clear();
});

test("status checks deduplicate, throttle retry/focus, recover from errors, and ignore stale/session responses", async () => {
  const access = new PosMaintenanceAccess();
  let checks = 0;
  const pending = deferred<unknown>();
  const fetch = async () => {
    checks++;
    return pending.promise;
  };
  const first = access.checkStatus(fetch, 0);
  const second = access.checkStatus(fetch, 1);
  assert.equal(first, second);
  pending.resolve(paused);
  await first;
  await access.checkStatus(fetch, 1000);
  assert.equal(checks, 1);
  await access.checkStatus(async () => {
    checks++;
    throw new Error("offline");
  }, 5000);
  assert.equal(access.getSnapshot().status, null);
  assert.match(access.getSnapshot().error!, /Unable to check/);
  assert.equal(access.canUsePos(), false);
  await access.checkStatus(async () => enabled, 10_000);
  assert.equal(access.canUsePos(), true);
  const old = deferred<unknown>();
  const oldCheck = access.checkStatus(() => old.promise, 15_000);
  access.reset();
  old.resolve(enabled);
  await oldCheck;
  assert.equal(access.canUsePos(), false);
  const stale = deferred<unknown>();
  const staleCheck = access.checkStatus(() => stale.promise, 20_000);
  access.applySavedStatus(paused);
  stale.resolve(enabled);
  await staleCheck;
  assert.equal(access.canUsePos(), false);
});
