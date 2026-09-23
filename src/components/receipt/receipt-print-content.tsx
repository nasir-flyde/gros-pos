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
  const invoiceDate = receipt.issuedAt ? new Date(receipt.issuedAt) : printedAt;
  const gstSlabs = Object.entries(receipt.gstByRate)
    .map(([rate, vals]) => ({
      rate: Number(rate),
      ...vals,
      total: vals.taxable + vals.cgst + vals.sgst + vals.igst,
    }))
    .sort((a, b) => a.rate - b.rate);
  const isB2B = Boolean(receipt.gstBuyer);
  const lineValue = receipt.itemsWithGst.reduce((sum, item) => sum + item.lineTotal, 0);
  const amount = (value: number) => Number(value || 0).toFixed(2);

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
      {receipt.gstBuyer && (
        <div className="break-words text-[10px]">
          <div className="text-center font-bold">Original for Recipient</div>
          <div>Customer: {receipt.gstBuyer.name}</div>
          <div>
            GSTIN: {receipt.gstBuyer.gstin} · PAN: {receipt.gstBuyer.pan}
          </div>
          <div>
            {[receipt.gstBuyer.flatDoorNo, receipt.gstBuyer.building].filter(Boolean).join(", ")}
          </div>
          <div>{receipt.gstBuyer.streetLocality}</div>
          <div>
            {receipt.gstBuyer.city}, {receipt.gstBuyer.state} - {receipt.gstBuyer.pincode}
          </div>
          {receipt.gstBuyer.phone && <div>Phone: {receipt.gstBuyer.phone}</div>}
          {receipt.gstBuyer.email && <div>Email: {receipt.gstBuyer.email}</div>}
          <div>
            Place of Supply &amp; State Code: {receipt.gstBuyer.stateCode}{" "}
            {receipt.gstBuyer.stateName}
          </div>
        </div>
      )}
      <div className="my-1.5 border-t border-dashed border-gray-300" />

      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        <span>Invoice No: {receipt.invoiceNumber}</span>
        <span className="text-right">
          {invoiceDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}{" "}
          {invoiceDate.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
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

      {isB2B ? (
        <div className="grid grid-cols-[17%_35%_18%_9%_21%] text-[9px] font-bold">
          <span>HSN Code</span>
          <span>Item Description</span>
          <span className="text-right">Net Price</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Value</span>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_2rem_3.5rem_3.5rem] gap-x-1 text-[10px] font-bold">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
        </div>
      )}

      <div
        className={cn("my-1 border-t", isB2B ? "border-dashed border-gray-400" : "border-gray-300")}
      />

      {receipt.itemsWithGst.map((item, idx) => {
        const name = item.variantName || `Item ${idx + 1}`;
        return (
          <div key={`${item.productVariantId ?? item.sku ?? idx}-${idx}`}>
            {isB2B ? (
              <>
                <div className="mb-1 text-[9px]">
                  {idx + 1}){" "}
                  {receipt.gstBuyer?.taxType === "INTER"
                    ? `IGST @ ${amount(item.taxRate)}%`
                    : `CGST @ ${amount(item.taxRate / 2)}%   SGST @ ${amount(item.taxRate / 2)}%`}
                </div>
                <div className="grid grid-cols-[17%_35%_18%_9%_21%] text-[9px] tabular-nums">
                  <span>{item.hsnCode}</span>
                  <span />
                  <span className="text-right">{amount(item.netPrice)}</span>
                  <span className="text-right">
                    {item.quantityUnit === "KG" ? formatWeight(item.quantity) : item.quantity}
                  </span>
                  <span className="text-right">{amount(item.lineTotal)}</span>
                </div>
                <div className="mb-1 break-words text-[9px] font-bold uppercase">{name}</div>
              </>
            ) : (
              <>
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
                {item.hsnCode && <div className="text-[9px]">HSN Code: {item.hsnCode}</div>}
              </>
            )}
            {item.markdownCode ? (
              <div className="mb-0.5 text-[9px] font-bold text-gray-600">
                MARKDOWN · Batch {item.batchNumber || "—"}
                {item.basePrice != null ? ` · Was ${formatINR(item.basePrice)}` : ""}
              </div>
            ) : null}
            {!isB2B && item.taxRate > 0 && (
              <div className="-mt-0.5 mb-0.5 text-right text-[9px] text-gray-500">
                {receipt.gstBuyer?.taxType === "INTER"
                  ? `IGST @${item.taxRate}%: ${formatINR(item.igst)}`
                  : `CGST @${item.taxRate / 2}%: ${formatINR(item.cgst)} SGST @${item.taxRate / 2}%: ${formatINR(item.sgst)}`}
              </div>
            )}
          </div>
        );
      })}

      <div className="my-1.5 border-t border-dashed border-gray-300" />

      <div className="space-y-0.5 text-[10px]">
        {isB2B ? (
          <>
            <div className="flex justify-between">
              <span>Items: {receipt.itemCount}</span>
              <span className="tabular-nums">
                Qty: {receipt.totalQty} &nbsp; {amount(lineValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gross Sales Value</span>
              <span className="tabular-nums">{amount(receipt.grossAmount)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span>Total Items: {receipt.itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Gross Amount:</span>
              <span className="tabular-nums">{formatINR(receipt.grossAmount)}</span>
            </div>
          </>
        )}
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
        {receipt.gstBuyer?.taxType === "INTER" ? (
          <div className="flex justify-between">
            <span>IGST:</span>
            <span>{formatINR(receipt.totalIgst)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>CGST:</span>
              <span>{formatINR(receipt.totalCgst)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST:</span>
              <span>{formatINR(receipt.totalSgst)}</span>
            </div>
          </>
        )}
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
            {receipt.gstBuyer?.taxType === "INTER" ? (
              <span className="w-12 text-right">IGST</span>
            ) : (
              <>
                <span className="w-12 text-right">CGST</span>
                <span className="w-12 text-right">SGST</span>
              </>
            )}
            <span className="w-14 text-right">Total</span>
          </div>
          {gstSlabs.map((slab) => (
            <div key={slab.rate} className="flex justify-between text-[9px]">
              <span className="w-10 tabular-nums">{slab.rate}%</span>
              <span className="w-14 text-right tabular-nums">{formatINR(slab.taxable)}</span>
              {receipt.gstBuyer?.taxType === "INTER" ? (
                <span className="w-12 text-right tabular-nums">{formatINR(slab.igst)}</span>
              ) : (
                <>
                  <span className="w-12 text-right tabular-nums">{formatINR(slab.cgst)}</span>
                  <span className="w-12 text-right tabular-nums">{formatINR(slab.sgst)}</span>
                </>
              )}
              <span className="w-14 text-right tabular-nums">{formatINR(slab.total)}</span>
            </div>
          ))}
          <div className="mt-0.5 flex justify-between border-t border-gray-300 pt-0.5 text-[9px] font-bold">
            <span className="w-10">Total</span>
            <span className="w-14 text-right tabular-nums">{formatINR(receipt.taxableValue)}</span>
            {receipt.gstBuyer?.taxType === "INTER" ? (
              <span className="w-12 text-right tabular-nums">{formatINR(receipt.totalIgst)}</span>
            ) : (
              <>
                <span className="w-12 text-right tabular-nums">{formatINR(receipt.totalCgst)}</span>
                <span className="w-12 text-right tabular-nums">{formatINR(receipt.totalSgst)}</span>
              </>
            )}
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
