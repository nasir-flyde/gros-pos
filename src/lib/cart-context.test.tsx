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
  quantityAvailable: 2,
};

const markdownOption = {
  markdownCode: "BATCH-MKD-123456789ABC",
  productVariantId: "variant-1",
  batchId: "batch-1",
  batchNumber: "B-001",
  expiryDate: "2026-09-30T23:59:59.999Z",
  basePrice: 299,
  effectivePrice: 130,
  remainingQuantity: 1,
};

const sampleCustomer: PosCartCustomer = {
  _id: "customer-1",
  name: "Neha",
  mobile: "9999999999",
  area: "Central",
};

const weightedProduct: CartProduct = {
  _id: "weighted-1",
  name: "Loose Rice",
  weight: "Sold by weight",
  mrp: 120,
  price: 120,
  taxRate: 5,
  quantityAvailable: 2,
  sellingMode: "WEIGHT",
  unitType: "KG",
};

function CartHarness() {
  const {
    add,
    setQuantity,
    applyMarkdown,
    inc,
    items,
    customer,
    setCustomer,
    activeOrderId,
    setActiveOrderId,
    afterDisc,
    count,
  } = useCart();

  return (
    <div>
      <button onClick={() => add(sampleProduct)}>Add product</button>
      <button
        onClick={() =>
          add({ ...sampleProduct, lineKey: "markdown-1", markdownCode: "markdown-1", price: 199 })
        }
      >
        Add markdown
      </button>
      <button onClick={() => inc(sampleProduct._id)}>Increase product</button>
      <button onClick={() => add({ ...sampleProduct, markdownOption })}>
        Scan markdown-eligible item
      </button>
      <button onClick={() => applyMarkdown(sampleProduct._id)}>Apply markdown option</button>
      <button onClick={() => add(weightedProduct, 0.25, "250g")}>Add weight</button>
      <button onClick={() => setQuantity(weightedProduct._id, 0.5, "500g")}>Edit weight</button>
      <button onClick={() => setCustomer(sampleCustomer)}>Add customer</button>
      <button onClick={() => setActiveOrderId("order-1")}>Set order</button>
      <div data-testid="count">{items.length}</div>
      <div data-testid="quantity">{items[0]?.qty ?? 0}</div>
      <div data-testid="weighted-quantity">
        {items.find((item) => item.product._id === weightedProduct._id)?.qty ?? 0}
      </div>
      <div data-testid="total">{afterDisc}</div>
      <div data-testid="markdown-code">{items[0]?.product.markdownCode ?? "none"}</div>
      <div data-testid="line-count">{count}</div>
      <div data-testid="customer">{customer?.name ?? "none"}</div>
      <div data-testid="order">{activeOrderId ?? "none"}</div>
    </div>
  );
}

describe("CartProvider persistence", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("isolates cart, customer and held order across store and tenant changes", () => {
    const view = render(
      <CartProvider scopeKey="tenant-a:user-a:store-a">
        <CartHarness />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));
    fireEvent.click(screen.getByRole("button", { name: /add customer/i }));
    fireEvent.click(screen.getByRole("button", { name: /set order/i }));
    for (const scopeKey of ["tenant-a:user-a:store-b", "tenant-b:user-b:store-a"]) {
      view.rerender(
        <CartProvider scopeKey={scopeKey}>
          <CartHarness />
        </CartProvider>,
      );
      expect(screen.getByTestId("count")).toHaveTextContent("0");
      expect(screen.getByTestId("customer")).toHaveTextContent("none");
      expect(screen.getByTestId("order")).toHaveTextContent("none");
    }
    view.rerender(
      <CartProvider scopeKey="tenant-a:user-a:store-a">
        <CartHarness />
      </CartProvider>,
    );
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("customer")).toHaveTextContent("Neha");
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

  it("caps cart quantity at the available stock", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add product/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase product/i }));
    fireEvent.click(screen.getByRole("button", { name: /increase product/i }));
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    expect(screen.getByTestId("quantity")).toHaveTextContent("2");
  });

  it("stores and edits weighted quantities in KG", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /add weight/i }));
    expect(screen.getByTestId("weighted-quantity")).toHaveTextContent("0.25");
    expect(screen.getByTestId("total")).toHaveTextContent("30");
    expect(screen.getByTestId("line-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: /edit weight/i }));
    expect(screen.getByTestId("weighted-quantity")).toHaveTextContent("0.5");
    expect(screen.getByTestId("total")).toHaveTextContent("60");
  });

  it("applies an available markdown option to a regular cart line", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /scan markdown-eligible item/i }));
    expect(screen.getByTestId("total")).toHaveTextContent("299");

    fireEvent.click(screen.getByRole("button", { name: /apply markdown option/i }));

    expect(screen.getByTestId("total")).toHaveTextContent("130");
    expect(screen.getByTestId("markdown-code")).toHaveTextContent(markdownOption.markdownCode);
  });

  it("keeps ordinary and markdown stock for the same variant on separate lines", () => {
    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));
    fireEvent.click(screen.getByRole("button", { name: /add markdown/i }));
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });
});
