import { describe, expect, it } from "vitest";
import { calculateWeightLineTotal, formatWeight, parseWeightInput } from "./weight";

describe("weight input", () => {
  it.each([
    [".100", 0.1],
    ["0.100", 0.1],
    ["250g", 0.25],
    ["250 gm", 0.25],
    ["500gms", 0.5],
    ["1kg", 1],
    ["1.75 kg", 1.75],
  ])("parses %s as %s KG", (input, kilograms) => {
    expect(parseWeightInput(input)?.kilograms).toBe(kilograms);
  });

  it.each(["", "0", "-1", "abc", "1.2345kg", "250lb", "0.5g"])("rejects %s", (input) =>
    expect(parseWeightInput(input)).toBeNull(),
  );

  it("formats grams and kilograms", () => {
    expect(formatWeight(0.25)).toBe("250 g");
    expect(formatWeight(1.75)).toBe("1.75 kg");
  });

  it("calculates a currency-rounded weighted line total", () => {
    expect(calculateWeightLineTotal(120, 0.25)).toBe(30);
  });
});
