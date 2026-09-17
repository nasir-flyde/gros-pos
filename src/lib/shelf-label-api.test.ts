import { describe, expect, it, vi } from "vitest";
import {
  buildShelfLabelItems,
  countShelfLabels,
  downloadShelfLabelPdf,
  printShelfLabelPdf,
} from "./shelf-label-api";

describe("shelf-label batch selection", () => {
  it("builds the backend payload and totals valid copies", () => {
    const selection = { "variant-1": 2, "variant-2": 1 };

    expect(buildShelfLabelItems(selection)).toEqual([
      { productVariantId: "variant-1", quantity: 2 },
      { productVariantId: "variant-2", quantity: 1 },
    ]);
    expect(countShelfLabels(selection)).toBe(3);
  });

  it("excludes zero, negative, and fractional copy counts", () => {
    const selection = { zero: 0, negative: -1, fractional: 1.5, valid: 4 };

    expect(buildShelfLabelItems(selection)).toEqual([{ productVariantId: "valid", quantity: 4 }]);
  });

  it("downloads a generated batch with a stable PDF filename", () => {
    const click = vi.fn();
    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue({ href: "", download: "", click } as unknown as HTMLAnchorElement);

    downloadShelfLabelPdf("blob:label", "SEL-123");

    expect(click).toHaveBeenCalledOnce();
    expect(createElement.mock.results[0].value).toMatchObject({
      href: "blob:label",
      download: "SEL-123.pdf",
    });
    createElement.mockRestore();
  });

  it("opens the print dialog after the PDF loads and reports blocked popups", () => {
    const print = vi.fn();
    const addEventListener = vi.fn((_event, callback: EventListener) =>
      callback(new Event("load")),
    );
    const open = vi.spyOn(window, "open").mockReturnValue({
      print,
      addEventListener,
    } as unknown as Window);

    expect(printShelfLabelPdf("blob:label")).toBe(true);
    expect(open).toHaveBeenCalledWith("blob:label", "_blank", "noopener,noreferrer");
    expect(print).toHaveBeenCalledOnce();

    open.mockReturnValue(null);
    expect(printShelfLabelPdf("blob:label")).toBe(false);
    open.mockRestore();
  });
});
