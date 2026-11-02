import { describe, expect, it } from "vitest";
import {
  getExchangePlan,
  remainingReturnQuantity,
  replacementQuantityFor,
} from "./exchange-quantities";
const item = { _id: "original", quantity: 1, lineTotal: 100, sellingMode: "FIXED" as const };
const variant = {
  _id: "replacement",
  sellingMode: "FIXED" as const,
  price: 50,
  quantityAvailable: 10,
};
describe("independent exchange quantities", () => {
  it.each([
    [2, 50, 100, 0],
    [3, 40, 120, 20],
    [2, 40, 80, -20],
  ])("returns one 100 item for %i replacements at %i", (qty, price, subtotal, balance) => {
    const plan = getExchangePlan(
      [item],
      { original: 1 },
      { original: String(qty) },
      { ...variant, price },
    );
    expect(plan.error).toBe("");
    expect(plan.lines[0]).toMatchObject({
      quantity: 1,
      replacementQuantity: qty,
      replacementProductVariantId: "replacement",
    });
    expect(plan.replacementValue).toBe(subtotal);
    expect(plan.priceDifference).toBe(balance);
  });
  it("keeps replacement edits independent and resets to the selected return quantity", () => {
    expect(replacementQuantityFor("original", 1, { original: "3" }, "FIXED")).toBe(3);
    expect(replacementQuantityFor("original", 2, { original: "3" }, "FIXED")).toBe(3);
    expect(replacementQuantityFor("original", 1, {}, "FIXED")).toBe(1);
    expect(replacementQuantityFor("original", 1, { original: "2" }, "FIXED")).toBe(2);
  });
  it.each(["", "0", "-1", "1.5", "NaN", "Infinity"])(
    "rejects invalid fixed replacement quantity %s",
    (value) => {
      expect(getExchangePlan([item], { original: 1 }, { original: value }, variant).error).not.toBe(
        "",
      );
    },
  );
  it("checks combined stock across independent original rows", () => {
    const items = [item, { ...item, _id: "second", lineTotal: 60 }];
    const plan = getExchangePlan(
      items,
      { original: 1, second: 1 },
      { original: "2", second: "3" },
      { ...variant, price: 40 },
    );
    expect(plan.lines.map((line) => line.replacementQuantity)).toEqual([2, 3]);
    expect(plan.returnedValue).toBe(160);
    expect(plan.priceDifference).toBe(40);
    expect(
      getExchangePlan(
        items,
        { original: 1, second: 1 },
        { original: "2", second: "3" },
        { ...variant, quantityAvailable: 4 },
      ).error,
    ).toContain("stock");
  });
  it("does not over-return fulfilled or pending lines but ignores rejected requests", () => {
    const records = [
      { status: "FULFILLED", items: [{ orderItemId: "original", requestedQuantity: 1 }] },
      { status: "REJECTED", items: [{ orderItemId: "original", requestedQuantity: 2 }] },
    ];
    expect(remainingReturnQuantity({ ...item, quantity: 3 }, records)).toBe(2);
    expect(getExchangePlan([item], { original: 2 }, { original: "2" }, variant).error).toContain(
      "return quantity",
    );
    expect(getExchangePlan([item], { original: 0.5 }, {}, variant).error).not.toBe("");
  });
  it("uses rounded discounted line credit and backend replacement-price precedence", () => {
    const plan = getExchangePlan(
      [{ ...item, quantity: 3, lineTotal: 100 }],
      { original: 1 },
      { original: "2" },
      { ...variant, finalPrice: 15 },
    );
    expect(plan.returnedValue).toBe(33.33);
    expect(plan.priceDifference).toBe(-3.33);
  });
  it("preserves weighted quantities within backend precision and rejects mixed units", () => {
    const weighted = { ...item, sellingMode: "WEIGHT" as const };
    const replacement = { ...variant, sellingMode: "WEIGHT" as const };
    expect(
      getExchangePlan([weighted], { original: 0.125 }, { original: "0.25" }, replacement).error,
    ).toBe("");
    expect(
      getExchangePlan([weighted], { original: 0.125 }, { original: "0.001" }, replacement).error,
    ).toContain("two decimal");
    expect(
      getExchangePlan([item], { original: 1 }, { original: "1" }, replacement).error,
    ).toContain("same quantity unit");
  });
});
