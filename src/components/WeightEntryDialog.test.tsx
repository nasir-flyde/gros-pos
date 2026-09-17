import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeightEntryDialog } from "./WeightEntryDialog";

describe("WeightEntryDialog", () => {
  it("converts grams, displays the amount, and confirms normalized KG", () => {
    const onConfirm = vi.fn();
    render(
      <WeightEntryDialog
        open
        productName="Loose Rice"
        pricePerKg={120}
        availableKg={2}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "250g" } });
    expect(screen.getByText("₹30.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(onConfirm).toHaveBeenCalledWith(0.25, "250g");
  });

  it("blocks a weight above available stock", () => {
    const onConfirm = vi.fn();
    render(
      <WeightEntryDialog
        open
        productName="Loose Rice"
        pricePerKg={120}
        availableKg={0.2}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "250g" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Only 200 g is available");
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  });
});
