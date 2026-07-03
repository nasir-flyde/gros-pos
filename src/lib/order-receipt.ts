import { orderApi, type PosOrder } from "@/lib/order-api";
import {
  buildReceiptFallbackFromOrder,
  normalizeReceiptData,
  type NormalizedReceipt,
} from "@/lib/receipt";
import { printNormalizedReceipt } from "@/lib/receipt-print";

export async function getNormalizedOrderReceipt(order: PosOrder): Promise<NormalizedReceipt> {
  const response = await orderApi.getReceipt(order._id);
  const receipt = normalizeReceiptData(response.data, buildReceiptFallbackFromOrder(order));

  if (!receipt) {
    throw new Error("Receipt is not available for this order yet.");
  }

  return receipt;
}

export async function fetchAndPrintOrderReceipt(order: PosOrder): Promise<boolean> {
  const receipt = await getNormalizedOrderReceipt(order);
  return printNormalizedReceipt(receipt);
}
