type SellingMode = "FIXED" | "WEIGHT";
export interface ExchangeLine {
  _id: string;
  quantity: number;
  lineTotal: number;
  sellingMode?: SellingMode;
}
export interface ExchangeVariant {
  _id: string;
  sellingMode: SellingMode;
  price: number;
  finalPrice?: number;
  sellingPrice?: number;
  quantityAvailable?: number;
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function remainingReturnQuantity(
  item: ExchangeLine,
  records: Array<{
    status: string;
    items: Array<{ orderItemId: string; requestedQuantity: number }>;
  }>,
) {
  const returned = records
    .filter((record) => record.status !== "REJECTED")
    .flatMap((record) => record.items || [])
    .filter((line) => line.orderItemId === item._id)
    .reduce((sum, line) => sum + Number(line.requestedQuantity || 0), 0);
  return Math.max(0, Math.round((item.quantity - returned) * 1000) / 1000);
}

export function replacementQuantityFor(
  itemId: string,
  returnQuantity: number,
  values: Record<string, string>,
  mode: SellingMode,
) {
  if (values[itemId] !== undefined) return Number(values[itemId]);
  // Fulfillment currently rounds replacement quantities to two decimals.
  return mode === "WEIGHT" ? Math.max(0.01, money(returnQuantity)) : returnQuantity;
}

export function getExchangePlan(
  items: ExchangeLine[],
  quantities: Record<string, number>,
  values: Record<string, string>,
  replacement: ExchangeVariant | null,
) {
  const selected = items.filter((item) => Number(quantities[item._id] || 0) > 0);
  const price = replacement?.finalPrice ?? replacement?.sellingPrice ?? replacement?.price ?? 0;
  const lines = selected.map((item) => ({
    orderItemId: item._id,
    quantity: quantities[item._id],
    replacementProductVariantId: replacement?._id || "",
    replacementQuantity: replacementQuantityFor(
      item._id,
      quantities[item._id],
      values,
      replacement?.sellingMode || "FIXED",
    ),
  }));
  let error = "";
  for (const item of selected) {
    const quantity = quantities[item._id];
    const mode = item.sellingMode || "FIXED";
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > item.quantity ||
      (mode === "FIXED"
        ? !Number.isInteger(quantity)
        : Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001)
    ) {
      error = "Enter a valid return quantity within the purchased quantity.";
    }
  }
  if (replacement) {
    for (const line of lines) {
      const qty = line.replacementQuantity;
      if (
        !Number.isFinite(qty) ||
        qty <= 0 ||
        (replacement.sellingMode === "FIXED"
          ? !Number.isInteger(qty)
          : Math.abs(qty * 100 - Math.round(qty * 100)) > 0.000001)
      ) {
        error =
          replacement.sellingMode === "FIXED"
            ? "Replacement quantity must be a positive whole number."
            : "Replacement quantity must be at least 0.01 KG with up to two decimal places.";
      }
    }
    // The backend ledger currently retains the original line's unit metadata.
    if (selected.some((item) => (item.sellingMode || "FIXED") !== replacement.sellingMode)) {
      error = "Choose a replacement with the same quantity unit (PCS or KG).";
    }
  }
  const totalQuantity = lines.reduce((sum, line) => sum + line.replacementQuantity, 0);
  if (
    replacement &&
    Number.isFinite(replacement.quantityAvailable) &&
    totalQuantity > Number(replacement.quantityAvailable) + 0.000001
  ) {
    error = "Replacement quantity exceeds available store stock.";
  }
  const returnedValue = money(
    selected.reduce(
      (sum, item) => sum + money(item.lineTotal / item.quantity) * quantities[item._id],
      0,
    ),
  );
  const replacementValue = money(
    money(price) * (Number.isFinite(totalQuantity) ? totalQuantity : 0),
  );
  return {
    lines,
    returnedValue,
    replacementValue,
    priceDifference: money(replacementValue - returnedValue),
    error,
  };
}
