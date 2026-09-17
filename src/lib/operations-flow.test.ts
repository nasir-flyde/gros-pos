import { describe, expect, it } from "vitest";
import type { PosOrder } from "./order-api";
import type { PosJoinedVariant } from "./product-api";
import type { RefundRecord } from "./refund-api";
import {
  buildSelectedTransferItems,
  buildTransferPayloadItems,
  clampTransferQuantity,
  getRefundableAmount,
  getRefundableItems,
  splitFulfillmentOrders,
} from "./operations-flow";

const baseOrder: PosOrder = {
  _id: "order-1",
  orderNumber: "POS-1",
  orderType: "POS",
  status: "COMPLETED",
  subtotal: 100,
  tax: 0,
  discount: 0,
  delivery: 0,
  grandTotal: 100,
  paymentMode: "CASH",
  deliveryType: "HOME",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
};

const variant: PosJoinedVariant = {
  _id: "variant-1",
  variantName: "Atta 5kg",
  productName: "Atta",
  categoryName: "Staples",
  categoryId: "cat-1",
  sku: "ATTA-5",
  sellingMode: "FIXED",
  unitValue: "5",
  unitType: "kg",
  mrp: 320,
  price: 299,
  barcode: "890100",
  barcodes: ["890100"],
  taxRate: 5,
  quantityAvailable: 3,
};

describe("operations flow helpers", () => {
  it("splits pickup and home fulfillment orders", () => {
    expect(
      splitFulfillmentOrders([
        baseOrder,
        { ...baseOrder, _id: "order-2", deliveryType: "PICKUP" },
        { ...baseOrder, _id: "order-3", deliveryType: "WALK_OUT" },
      ]),
    ).toEqual({
      homeOrders: [baseOrder],
      pickupOrders: [{ ...baseOrder, _id: "order-2", deliveryType: "PICKUP" }],
    });
  });

  it("calculates remaining refundable amount after previous refunds", () => {
    const order = {
      ...baseOrder,
      items: [
        {
          _id: "line-1",
          quantity: 1,
          unitPrice: 100,
          lineTotal: 100,
        },
      ],
    };
    const refunds = [
      {
        _id: "refund-1",
        refundAmount: 40,
      },
    ] as RefundRecord[];

    const items = getRefundableItems(order);

    expect(items).toHaveLength(1);
    expect(getRefundableAmount(items, refunds)).toBe(60);
    expect(
      getRefundableAmount(items, [{ _id: "refund-2", refundAmount: 120 } as RefundRecord]),
    ).toBe(0);
  });

  it("clamps transfer quantities to available stock", () => {
    expect(clampTransferQuantity(9, 3)).toBe(3);
    expect(clampTransferQuantity(-1, 3)).toBe(0);

    expect(buildSelectedTransferItems([variant], { "variant-1": 9 })).toEqual([
      expect.objectContaining({ _id: "variant-1", quantity: 3 }),
    ]);
    expect(buildTransferPayloadItems([variant], { "variant-1": 2 })).toEqual([
      { productVariantId: "variant-1", quantity: 2 },
    ]);
  });
});
