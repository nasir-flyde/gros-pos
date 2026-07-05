import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart, type CartProduct, type PosCartCustomer } from "./cart-context";

const sampleProduct: CartProduct = {
  _id: "variant-1",
  name: "Atta 5kg",
  weight: "5 kg",
  mrp: 320,
  price: 299,
  taxRate: 5,
};

const sampleCustomer: PosCartCustomer = {
  _id: "customer-1",
  name: "Neha",
  mobile: "9999999999",
  area: "Central",
};

function CartHarness() {
  const { add, items, customer, setCustomer, activeOrderId, setActiveOrderId } = useCart();

  return (
    <div>
      <button onClick={() => add(sampleProduct)}>Add product</button>
      <button onClick={() => setCustomer(sampleCustomer)}>Add customer</button>
      <button onClick={() => setActiveOrderId("order-1")}>Set order</button>
      <div data-testid="count">{items.length}</div>
      <div data-testid="customer">{customer?.name ?? "none"}</div>
      <div data-testid="order">{activeOrderId ?? "none"}</div>
    </div>
  );
}

describe("CartProvider persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("restores cart state after remounting", () => {
    const view = render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add product/i }));
    fireEvent.click(screen.getByRole("button", { name: /add customer/i }));
    fireEvent.click(screen.getByRole("button", { name: /set order/i }));

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("customer")).toHaveTextContent("Neha");
    expect(screen.getByTestId("order")).toHaveTextContent("order-1");

    view.unmount();

    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("customer")).toHaveTextContent("Neha");
    expect(screen.getByTestId("order")).toHaveTextContent("order-1");
  });
});
