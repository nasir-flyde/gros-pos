import { describe, expect, it } from "vitest";
import { canPrintShelfLabels, canViewShelfLabels } from "./shelf-label-access";

describe("shelf-label permission access", () => {
  it("allows read and print permissions to view SEL printing", () => {
    expect(canViewShelfLabels(["shelfLabel.read"])).toBe(true);
    expect(canViewShelfLabels(["shelfLabel.print"])).toBe(true);
  });

  it("requires print permission for label generation", () => {
    expect(canPrintShelfLabels(["shelfLabel.read"])).toBe(false);
    expect(canPrintShelfLabels(["shelfLabel.print"])).toBe(true);
  });

  it("allows super admins and denies unrelated permissions", () => {
    expect(canViewShelfLabels([], true)).toBe(true);
    expect(canPrintShelfLabels([], true)).toBe(true);
    expect(canViewShelfLabels(["product.read"])).toBe(false);
  });
});
