import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { NormalizedReceipt } from "@/lib/receipt";
import { formatWeight } from "@/lib/weight";

export function ReceiptPrintContent({
  receipt,
  id,
  className,
  printedAt = new Date(),
}: {
  receipt: NormalizedReceipt;
  id?: string;
  className?: string;
  printedAt?: Date;
}) {
  const gstSlabs = Object.entries(receipt.gstByRate)
    .map(([rate, vals]) => ({
      rate: Number(rate),
      ...vals,
      total: vals.taxable + vals.cgst + vals.sgst,
    }))
    .sort((a, b) => a.rate - b.rate);

  return (
    <div
      id={id}
      data-receipt-print-content
      className={cn(
        "mx-auto max-w-sm rounded-2xl border-2 bg-white p-5 text-left font-mono text-xs leading-relaxed text-black shadow-sm",
        className,
      )}
    >
      <div className="text-center text-sm font-bold uppercase tracking-wide">
        {receipt.storeName}
      </div>
      {receipt.orgLegalName && (
        <div className="text-center text-[11px]">{receipt.orgLegalName}</div>
      )}
      {receipt.addressStr && (
        <div className="text-center text-[10px] text-gray-600">{receipt.addressStr}</div>
      )}
      {receipt.cityLine && (
        <div className="text-center text-[10px] text-gray-600">{receipt.cityLine}</div>
      )}
      {receipt.orgGstin && (
        <div className="text-center text-[10px] text-gray-600">GSTIN: {receipt.orgGstin}</div>
      )}
      {receipt.fssaiLicense && (
        <div className="text-center text-[10px] text-gray-600">
          FSSAI LIC NO: {receipt.fssaiLicense}
        </div>
      )}
      {receipt.cinNumber && (
        <div className="text-center text-[10px] text-gray-600">CIN: {receipt.cinNumber}</div>
      )}

      <div className="my-2 border-t border-dashed border-gray-400" />
      <div className="text-center text-xs font-bold tracking-wide">TAX INVOICE</div>
      <div className="my-1.5 border-t border-dashed border-gray-300" />

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        <span>Invoice No: {receipt.invoiceNumber}</span>
        <span className="text-right">
          {printedAt.toLocaleDateString("en-IN")}{" "}
          {printedAt.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </span>
        {receipt.storeCode && <span className="col-span-2">Store Code: {receipt.storeCode}</span>}
        {receipt.cashierName && <span className="col-span-2">Cashier: {receipt.cashierName}</span>}
        {receipt.customerName && (
          <span className="col-span-2 truncate">Customer: {receipt.customerName}</span>
        )}
      </div>

      <div className="my-1.5 border-t border-dashed border-gray-300" />

      <div className="grid grid-cols-[minmax(0,1fr)_2rem_3.5rem_3.5rem] gap-x-1 text-[10px] font-bold">
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amount</span>
      </div>

      <div className="my-1 border-t border-gray-300" />

      {receipt.itemsWithGst.map((item, idx) => {
        const name = item.variantName || `Item ${idx + 1}`;
        return (
          <div key={`${item.productVariantId ?? item.sku ?? idx}-${idx}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_2rem_3.5rem_3.5rem] items-start gap-x-1 text-[10px]">
              <span className="break-words whitespace-normal leading-tight">{name}</span>
              <span className="tabular-nums text-right">
                {item.quantityUnit === "KG" ? formatWeight(item.quantity) : item.quantity}
              </span>
              <span className="tabular-nums text-right">
                {formatINR(item.unitPrice)}
                {item.quantityUnit === "KG" ? "/KG" : ""}
              </span>
              <span className="tabular-nums text-right">{formatINR(item.lineTotal)}</span>
            </div>
            {item.markdownCode ? (
              <div className="mb-0.5 text-[9px] font-bold text-gray-600">
                MARKDOWN · Batch {item.batchNumber || "—"}
                {item.basePrice != null ? ` · Was ${formatINR(item.basePrice)}` : ""}
              </div>
            ) : null}
            {item.taxRate > 0 && (
              <div className="-mt-0.5 mb-0.5 text-right text-[9px] text-gray-500">
                CGST @{item.taxRate / 2}%: {formatINR(item.cgst)} SGST @{item.taxRate / 2}%:{" "}
                {formatINR(item.sgst)}
              </div>
            )}
          </div>
        );
      })}

      <div className="my-1.5 border-t border-dashed border-gray-300" />

      <div className="space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span>Total Items: {receipt.itemCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Gross Amount:</span>
          <span className="tabular-nums">{formatINR(receipt.grossAmount)}</span>
        </div>
        {receipt.discount > 0 && (
          <div className="flex justify-between">
            <span>
              Discount{receipt.discountPercent > 0 ? ` @ ${receipt.discountPercent}%` : ""}:
            </span>
            <span className="tabular-nums">-{formatINR(receipt.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Net Sales Value:</span>
          <span className="tabular-nums">{formatINR(receipt.netSalesValue)}</span>
        </div>
        <div className="flex justify-between">
          <span>CGST:</span>
          <span className="tabular-nums">{formatINR(receipt.totalCgst)}</span>
        </div>
        <div className="flex justify-between">
          <span>SGST:</span>
          <span className="tabular-nums">{formatINR(receipt.totalSgst)}</span>
        </div>
      </div>

      <div className="my-1.5 border-t border-dashed border-gray-400" />

      <div className="flex justify-between text-xs font-bold">
        <span>TOTAL PAID:</span>
        <span className="tabular-nums">{formatINR(receipt.grandTotal)}</span>
      </div>

      <div className="mt-1 space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span>Payment Mode:</span>
          <span className="tabular-nums">{receipt.paymentMode}</span>
        </div>
        {receipt.paymentRef && (
          <div className="flex justify-between">
            <span>Ref No:</span>
            <span className="tabular-nums">{receipt.paymentRef}</span>
          </div>
        )}
      </div>

      <div className="my-1.5 border-t border-dashed border-gray-400" />

      {gstSlabs.length > 0 && (
        <>
          <div className="mb-1 text-center text-[10px] font-bold">GST BREAKUP DETAILS</div>
          <div className="flex justify-between border-b border-gray-300 pb-0.5 text-[9px] font-bold">
            <span className="w-10">GST %</span>
            <span className="w-14 text-right">Taxable</span>
            <span className="w-12 text-right">CGST</span>
            <span className="w-12 text-right">SGST</span>
            <span className="w-14 text-right">Total</span>
          </div>
          {gstSlabs.map((slab) => (
            <div key={slab.rate} className="flex justify-between text-[9px]">
              <span className="w-10 tabular-nums">{slab.rate}%</span>
              <span className="w-14 text-right tabular-nums">{formatINR(slab.taxable)}</span>
              <span className="w-12 text-right tabular-nums">{formatINR(slab.cgst)}</span>
              <span className="w-12 text-right tabular-nums">{formatINR(slab.sgst)}</span>
              <span className="w-14 text-right tabular-nums">{formatINR(slab.total)}</span>
            </div>
          ))}
          <div className="mt-0.5 flex justify-between border-t border-gray-300 pt-0.5 text-[9px] font-bold">
            <span className="w-10">Total</span>
            <span className="w-14 text-right tabular-nums">{formatINR(receipt.taxableValue)}</span>
            <span className="w-12 text-right tabular-nums">{formatINR(receipt.totalCgst)}</span>
            <span className="w-12 text-right tabular-nums">{formatINR(receipt.totalSgst)}</span>
            <span className="w-14 text-right tabular-nums">{formatINR(receipt.grandTotal)}</span>
          </div>

          <div className="my-1.5 border-t border-dashed border-gray-400" />

          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Taxable Value:</span>
              <span className="tabular-nums">{formatINR(receipt.taxableValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total GST:</span>
              <span className="tabular-nums">{formatINR(receipt.totalGst)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Invoice Total:</span>
              <span className="tabular-nums">{formatINR(receipt.grandTotal)}</span>
            </div>
          </div>
        </>
      )}

      <div className="my-1.5 border-t border-dashed border-gray-400" />

      <div className="mt-2 text-center text-[9px] text-gray-500">
        Goods once sold will not be taken back unless covered under applicable return policy.
      </div>
      <div className="text-center text-[9px] text-gray-500">
        Amount shown above is inclusive of GST.
      </div>
      <div className="text-center text-[9px] text-gray-500">
        This is a computer generated invoice.
      </div>
      <div className="mt-2 text-center text-[10px] font-medium">
        Thank You for shopping with us.
      </div>
    </div>
  );
}
