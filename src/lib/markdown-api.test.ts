import { describe, expect, it } from "vitest";
import { isMarkdownCode } from "./markdown-api";

describe("markdown barcode recognition", () => {
  it("accepts legacy and approved batch markdown codes", () => {
    expect(isMarkdownCode("MD0123456789ABCDEF0123")).toBe(true);
    expect(isMarkdownCode("BATCH-MKD-A1B2C3D4E5F6")).toBe(true);
  });

  it("does not treat a base EAN as a markdown code", () => {
    expect(isMarkdownCode("8901234567890")).toBe(false);
    expect(isMarkdownCode("BATCH-MKD-TOO-SHORT")).toBe(false);
  });
});
