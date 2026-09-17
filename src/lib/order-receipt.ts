import { orderApi, type PosOrder } from "@/lib/order-api";
import {
  buildReceiptFallbackFromOrder,
  normalizeReceiptData,
  type NormalizedReceipt,
} from "@/lib/receipt";
import { printNormalizedReceipt, printReceiptHtml } from "@/lib/receipt-print";

export async function getOrderReceiptHtml(orderId: string): Promise<string> {
  const receiptHtml = await orderApi.getReceiptHtml(orderId);

  if (typeof receiptHtml !== "string" || !receiptHtml.trim()) {
    throw new Error("Printable receipt HTML is not available for this order yet.");
  }

  return receiptHtml;
}

export async function fetchAndPrintOrderReceiptHtml(orderId: string): Promise<boolean> {
  return printReceiptHtml(await getOrderReceiptHtml(orderId));
}

export async function getNormalizedOrderReceipt(order: PosOrder): Promise<NormalizedReceipt> {
  const response = await orderApi.getReceipt(order._id);
  const receipt = normalizeReceiptData(response.data, buildReceiptFallbackFromOrder(order));

  if (!receipt) {
    throw new Error("Receipt is not available for this order yet.");
  }

  return receipt;
}

export async function fetchAndPrintOrderReceipt(order: PosOrder): Promise<boolean> {
  try {
    if (await fetchAndPrintOrderReceiptHtml(order._id)) {
      return true;
    }
  } catch {
    // Keep the existing JSON receipt as a fallback while backend HTML is unavailable.
  }

  const receipt = await getNormalizedOrderReceipt(order);
  return printNormalizedReceipt(receipt);
}
