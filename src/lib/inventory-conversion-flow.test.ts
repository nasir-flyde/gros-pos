import { describe, expect, it } from "vitest";
import {
  calculateExpectedOutput,
  canUsePackBreakdown,
  requiresLossReason,
} from "./inventory-conversion-flow";

describe("pack breakdown workflow", () => {
  it("requires all three operator permissions but always allows super admins", () => {
    expect(
      canUsePackBreakdown([
        "inventory.conversion.read",
        "inventory.conversion.write",
        "store.inventory.read",
      ]),
    ).toBe(true);
    expect(canUsePackBreakdown(["inventory.conversion.read", "inventory.conversion.write"])).toBe(
      false,
    );
    expect(canUsePackBreakdown([], true)).toBe(true);
  });

  it("calculates pen and kilogram output with the correct precision", () => {
    expect(calculateExpectedOutput(3, 1, 5, "FIXED")).toBe(15);
    expect(calculateExpectedOutput(2, 1, 50, "WEIGHT")).toBe(100);
    expect(calculateExpectedOutput(1, 3, 1, "WEIGHT")).toBe(0.333);
  });

  it("requires a reason only for positive output below expectation", () => {
    expect(requiresLossReason(99.5, 100)).toBe(true);
    expect(requiresLossReason(100, 100)).toBe(false);
    expect(requiresLossReason(0, 100)).toBe(false);
  });
});
