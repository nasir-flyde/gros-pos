"use strict";
// Runs against a disposable MongoDB via the integrated backend's test setup.
const path = require("node:path");
const root = process.env.GROS_BACKEND_ROOT;
const load = (file) => require(path.join(root, file));
const mongoose = load("node_modules/mongoose");
const request = load("node_modules/supertest");
const app = load("src/app");
const { generateAccessToken } = load("src/common/utils/token");
const Store = load("src/modules/stores/model/store.model");
const Order = load("src/modules/orders/model/order.model");
const OrderItem = load("src/modules/orders/model/orderItem.model");
const Return = load("src/modules/returns/model/return.model");
const InventoryTransaction = load("src/modules/inventory/model/inventoryTransaction.model");
const Refund = load("src/modules/refunds/model/refund.model");

let organizationId, storeId, payload, token, approver, readonly, otherStore, otherTenant;
const id = () => new mongoose.Types.ObjectId();
function access(permissions, store = storeId, organization = organizationId) {
  return generateAccessToken(
    { _id: id(), organizationId: organization, isSuperAdmin: false },
    permissions,
    [{ type: "store", id: String(store), name: "Test Store" }],
  );
}
const send = (method, url, auth, data, key) => {
  const req = request(app)[method](`/api/v1${url}`).set("Authorization", `Bearer ${auth}`);
  if (key) req.set("Idempotency-Key", key);
  return data ? req.send(data) : req;
};
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  organizationId = id();
  const store = await Store.create({
    organizationId,
    cityId: id(),
    storeCode: "CONTRACT-STORE",
    storeName: "Test Store",
  });
  storeId = store._id;
  const order = await Order.create({
    organizationId,
    storeId,
    cashierId: id(),
    orderNumber: "POS-CONTRACT-1",
    orderType: "POS",
    status: "COMPLETED",
    subtotal: 100,
    grandTotal: 100,
    paymentMode: "CASH",
    deliveryType: "WALK_OUT",
  });
  const item = await OrderItem.create({
    organizationId,
    orderId: order._id,
    productVariantId: id(),
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
  });
  payload = {
    orderId: String(order._id),
    channel: "IN_STORE",
    issueType: "CUSTOMER_RETURN",
    resolutionType: "REFUND",
    refundMethod: "CASH",
    receiptVerified: true,
    reason: "Damaged packaging",
    items: [{ orderItemId: String(item._id), quantity: 1, disposition: "DAMAGED" }],
  };
  token = access(["order.read", "return.read", "return.write"]);
  approver = access(["return.read", "return.approve"]);
  readonly = access(["order.read", "return.read"]);
  otherStore = access(["return.read", "return.write"], id());
  otherTenant = access(["return.read", "return.write"], storeId, id());
});
afterAll(async () => {
  await mongoose.disconnect();
});

test("POS payload requires write permission, matching tenant and store", async () => {
  expect((await send("post", "/returns", readonly, payload)).status).toBe(403);
  expect((await send("post", "/returns", otherStore, payload)).status).toBe(403);
  expect((await send("post", "/returns", otherTenant, payload)).status).toBe(404);
  expect(await Return.countDocuments({ organizationId })).toBe(0);
});

test("approval request replays safely; cashiers cannot approve or fulfill, and no funds or stock are posted", async () => {
  const created = await send("post", "/returns", token, payload, "pos-contract-retry-1");
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({
    status: "REQUESTED",
    resolutionType: "REFUND",
    refundMethod: "CASH",
    refundAmount: 100,
  });
  const returnId = created.body.data._id;
  const retry = await send("post", "/returns", token, payload, "pos-contract-retry-1");
  expect(retry.status).toBe(201);
  expect(retry.body.data._id).toBe(returnId);
  expect(await Return.countDocuments({ organizationId })).toBe(1);
  const approvals = {
    items: created.body.data.items.map((item) => ({
      returnItemId: item._id,
      approvedQuantity: item.requestedQuantity,
    })),
  };
  expect((await send("post", `/returns/${returnId}/verify`, token, approvals)).status).toBe(403);
  expect((await send("post", `/returns/${returnId}/fulfill`, token, {})).status).toBe(403);
  const verified = await send(
    "post",
    `/returns/${returnId}/verify`,
    approver,
    approvals,
    "pos-contract-approve-1",
  );
  expect(verified.status).toBe(200);
  expect(verified.body.data.status).toBe("VERIFIED");
  expect(
    (await send("post", "/returns", token, payload, "pos-contract-different-key")).status,
  ).toBe(400);
  expect(await Refund.countDocuments({ organizationId })).toBe(0);
  expect(await InventoryTransaction.countDocuments({ organizationId })).toBe(0);
  const listed = await send("get", `/returns?orderId=${payload.orderId}`, token);
  expect(listed.status).toBe(200);
  expect(listed.body.data).toHaveLength(1);
});
