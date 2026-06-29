import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/utils";
import { CheckCircle2, Printer, Bike, Plus } from "lucide-react";

export const Route = createFileRoute("/_pos/success")({
  head: () => ({ meta: [{ title: "Order Placed — CHHOTA BAZAAR POS" }] }),
  component: SuccessPage,
});

const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "37", "Arunachal Pradesh": "12", Assam: "18",
  Bihar: "10", Chhattisgarh: "22", Goa: "30", Gujarat: "24",
  Haryana: "06", "Himachal Pradesh": "02", "Jammu and Kashmir": "01",
  Jharkhand: "20", Karnataka: "29", Kerala: "32",
  "Madhya Pradesh": "23", Maharashtra: "27", Manipur: "14",
  Meghalaya: "17", Mizoram: "15", Nagaland: "13", Odisha: "21",
  Punjab: "03", Rajasthan: "08", Sikkim: "11",
  "Tamil Nadu": "33", Telangana: "36", Tripura: "16",
  "Uttar Pradesh": "09", Uttarakhand: "05", "West Bengal": "19",
};

function SuccessPage() {
  const { lastCheckout, items } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastCheckout) navigate({ to: "/new-order" });
  }, [lastCheckout, navigate]);

  const receipt = useMemo(() => {
    if (!lastCheckout) return null;

    const { orderId, customer, total, payment, delivery, receiptData } = lastCheckout;

    const rd = receiptData as Record<string, unknown> | undefined;
    const rdNested = (rd?.receiptData ?? rd) as Record<string, unknown> | undefined;

    const rdItems: Record<string, unknown>[] =
      (rdNested?.items as Record<string, unknown>[]) ||
      (rd?.items as Record<string, unknown>[]) ||
      [];

    const storeInfo = (rdNested?.storeInfo ??
      rd?.storeInfo ??
      {}) as Record<string, unknown>;

    const payments: Record<string, unknown>[] =
      (rdNested?.payments as Record<string, unknown>[]) ||
      (rd?.payments as Record<string, unknown>[]) ||
      [];

    const paid = (rdNested?.paid as number) ?? (rd?.paid as number) ?? total;
    const changeAmount =
      (rdNested?.changeAmount as number) ?? (rd?.changeAmount as number) ?? 0;
    const subtotal = (rdNested?.subtotal as number) ?? (rd?.subtotal as number) ?? 0;
    const discount = (rdNested?.discount as number) ?? (rd?.discount as number) ?? 0;
    const tax = (rdNested?.tax as number) ?? (rd?.tax as number) ?? 0;
    const deliveryCharge =
      (rdNested?.delivery as number) ?? (rd?.delivery as number) ?? 0;
    const grandTotal =
      (rdNested?.grandTotal as number) ?? (rd?.grandTotal as number) ?? total;
    const cashierName = (rdNested?.cashierName as string) ?? (rd?.cashierName as string) ?? "";
    const customerName =
      (rdNested?.customerName as string) ?? (rd?.customerName as string) ?? customer ?? "";
    const orderNumber =
      (rdNested?.orderNumber as string) ?? (rd?.orderNumber as string) ?? orderId ?? "";
    const invoiceNumber = (rd?.receiptNumber as string) ?? orderNumber;
    const paymentMode =
      (rdNested?.paymentMode as string) ?? (rd?.paymentMode as string) ?? payment ?? "";

    const storeAddress = storeInfo?.address as Record<string, string> | undefined;
    const stateName = storeAddress?.state || "";
    const stateCode = STATE_CODES[stateName] || "";
    const orgInfo = (rdNested?.organizationInfo as Record<string, unknown>) || null;
    const orgLegalName = (orgInfo?.legalName as string) || "";
    const orgGstin: string = (orgInfo?.gstNumber as string) || (storeInfo?.gstNumber as string) || "";
    const orgEmail: string = (orgInfo?.email as string) || "";
    const fssaiLicense: string = (orgInfo?.fssaiLicense as string) || (storeInfo?.fssaiLicense as string) || "";
    const cinNumber: string = (orgInfo?.cinNumber as string) || (storeInfo?.cinNumber as string) || "";

    const line1 = storeAddress?.line1 || "";
    const line2 = storeAddress?.line2 || "";
    const city = storeAddress?.city || "";
    const pincode = storeAddress?.pincode || "";
    const addressStr = [line1, line2].filter(Boolean).join(", ");
    const cityLine = [city, stateName, pincode].filter(Boolean).join(", ");

    const itemCount = rdItems.length;
    const totalQty = rdItems.reduce((s, i) => s + ((i.quantity as number) || 0), 0);
    const grossAmount = rdItems.reduce(
      (s, i) => s + ((i.unitPrice as number) || 0) * ((i.quantity as number) || 0),
      0,
    );

    const gstByRate: Record<number, { taxable: number; cgst: number; sgst: number }> = {};
    const itemsWithGst = rdItems.map((item) => {
      const rate = (item.taxRate as number) || 0;
      const lineTotal = (item.lineTotal as number) || 0;
      const half = rate / 2;
      const taxable = Math.round((lineTotal * 100) / (100 + rate) * 100) / 100;
      const cgst = Math.round(taxable * half) / 100;
      const sgst = Math.round(taxable * half) / 100;

      if (!gstByRate[rate]) gstByRate[rate] = { taxable: 0, cgst: 0, sgst: 0 };
      gstByRate[rate].taxable += taxable;
      gstByRate[rate].cgst += cgst;
      gstByRate[rate].sgst += sgst;

      return {
        ...item,
        cgst,
        sgst,
      };
    });

    const netSalesValue = subtotal + tax - discount;
    const totalCgst = Object.values(gstByRate).reduce((s, r) => s + r.cgst, 0);
    const totalSgst = Object.values(gstByRate).reduce((s, r) => s + r.sgst, 0);
    const totalGst = totalCgst + totalSgst;
    const taxableValue = Object.values(gstByRate).reduce((s, r) => s + r.taxable, 0);

    return {
      orderId,
      total,
      rdItems,
      itemsWithGst,
      storeInfo,
      storeAddress,
      payments,
      paid,
      changeAmount,
      subtotal,
      discount,
      tax,
      deliveryCharge,
      grandTotal,
      cashierName,
      customerName,
      orderNumber,
      invoiceNumber,
      paymentMode,
      stateName,
      stateCode,
      addressStr,
      cityLine,
      itemCount,
      totalQty,
      grossAmount: Math.round(grossAmount * 100) / 100,
      netSalesValue: Math.round(netSalesValue * 100) / 100,
      gstByRate,
      storeName: (storeInfo.storeName as string) || "CHHOTA BAZAAR",
      storePhone: (storeInfo.phone as string) || "",
      storeGst: (storeInfo.gstNumber as string) || "",
      storeCode: (storeInfo.storeCode as string) || "",
      orgLegalName,
      orgGstin,
      orgEmail,
      fssaiLicense,
      cinNumber,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      taxableValue: Math.round(taxableValue * 100) / 100,
      paymentRef:
        payments[0]?.referenceNumber || payments[0]?._id
          ? String(payments[0]?.referenceNumber || payments[0]?._id).slice(-8)
          : "",
      delivery,
    };
  }, [lastCheckout]);

  const printReceipt = () => {
    const printContent = document.getElementById("receipt-print");
    if (!printContent) return;
    const original = document.body.innerHTML;
    document.body.innerHTML = printContent.outerHTML;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };

  if (!receipt) return null;

  const {
    itemsWithGst,
    storeName,
    addressStr,
    cityLine,
    storePhone,
    storeCode,
    orderNumber,
    invoiceNumber,
    cashierName,
    itemCount,
    totalQty,
    grossAmount,
    discount,
    deliveryCharge,
    netSalesValue,
    grandTotal,
    paid,
    changeAmount,
    paymentMode,
    paymentRef,
    gstByRate,
    customerName,
    delivery,
    orderId,
    total,
    orgLegalName,
    orgGstin,
    fssaiLicense,
    cinNumber,
    totalCgst,
    totalSgst,
    totalGst,
    taxableValue,
  } = receipt;

  const gstSlabs = Object.entries(gstByRate)
    .map(([rate, vals]) => ({
      rate: Number(rate),
      ...vals,
      total: vals.taxable + vals.cgst + vals.sgst,
    }))
    .sort((a, b) => a.rate - b.rate);

  const gstGrandTotal = gstSlabs.reduce((s, r) => s + r.total, 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border-2 border-[var(--brand-green)]/30 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[var(--brand-green)] text-white shadow-md">
            <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Order Placed!</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Receipt ready to print
          </p>

          {/* Receipt Preview */}
          <div
            id="receipt-print"
            className="mx-auto mt-6 max-w-sm rounded-2xl border-2 bg-white p-5 text-left font-mono text-xs leading-relaxed text-black shadow-sm"
          >
            {/* Store Header */}
            <div className="text-center font-bold text-sm uppercase tracking-wide">
              {storeName}
            </div>
            {orgLegalName && (
              <div className="text-center text-[11px]">{orgLegalName}</div>
            )}
            {addressStr && (
              <div className="text-center text-[10px] text-gray-600">{addressStr}</div>
            )}
            {cityLine && (
              <div className="text-center text-[10px] text-gray-600">{cityLine}</div>
            )}
            {orgGstin && (
              <div className="text-center text-[10px] text-gray-600">GSTIN: {orgGstin}</div>
            )}
            {fssaiLicense && (
              <div className="text-center text-[10px] text-gray-600">FSSAI LIC NO: {fssaiLicense}</div>
            )}
            {cinNumber && (
              <div className="text-center text-[10px] text-gray-600">CIN: {cinNumber}</div>
            )}

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Tax Invoice Header */}
            <div className="text-center font-bold text-xs tracking-wide">
              TAX INVOICE
            </div>

            <div className="my-1.5 border-t border-dashed border-gray-300" />

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <span>Invoice No: {invoiceNumber}</span>
              <span className="text-right">
                {new Date().toLocaleDateString("en-IN")} {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
              {storeCode && (
                <span className="col-span-2">Store Code: {storeCode}</span>
              )}
              {cashierName && (
                <span className="col-span-2">Cashier: {cashierName}</span>
              )}
              {customerName && (
                <span className="col-span-2 truncate">Customer: {customerName}</span>
              )}
            </div>

            <div className="my-1.5 border-t border-dashed border-gray-300" />

            {/* Column Headers */}
            <div className="flex justify-between text-[10px] font-bold">
              <span className="flex-1">Item</span>
              <span className="w-8 text-right shrink-0">Qty</span>
              <span className="w-14 text-right shrink-0">Rate</span>
              <span className="w-14 text-right shrink-0">Amount</span>
            </div>

            <div className="my-1 border-t border-gray-300" />

            {/* Line Items */}
            {itemsWithGst.map((item: Record<string, unknown>, idx: number) => {
              const name = (item.variantName as string) || (item.sku as string) || `Item ${idx + 1}`;
              const price = item.unitPrice as number;
              const qty = item.quantity as number;
              const amt = item.lineTotal as number;
              const rate = (item.taxRate as number) || 0;
              const cgstAmt = (item.cgst as number) || 0;
              const sgstAmt = (item.sgst as number) || 0;
              return (
                <div key={idx}>
                  <div className="flex justify-between text-[10px]">
                    <span className="flex-1 truncate">{name}</span>
                    <span className="w-8 text-right shrink-0 tabular-nums">{qty}</span>
                    <span className="w-14 text-right shrink-0 tabular-nums">
                      {formatINR(price)}
                    </span>
                    <span className="w-14 text-right shrink-0 tabular-nums">
                      {formatINR(amt)}
                    </span>
                  </div>
                  {rate > 0 && (
                    <div className="text-[9px] text-gray-500 text-right -mt-0.5 mb-0.5">
                      CGST @{rate / 2}%: {formatINR(cgstAmt)}  SGST @{rate / 2}%: {formatINR(sgstAmt)}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="my-1.5 border-t border-dashed border-gray-300" />

            {/* Summary — matching template order */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>Total Items: {itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Amount:</span>
                <span className="tabular-nums">{formatINR(grossAmount)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="tabular-nums">-{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Net Sales Value:</span>
                <span className="tabular-nums">{formatINR(netSalesValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST:</span>
                <span className="tabular-nums">{formatINR(totalCgst)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST:</span>
                <span className="tabular-nums">{formatINR(totalSgst)}</span>
              </div>
            </div>

            <div className="my-1.5 border-t border-dashed border-gray-400" />

            <div className="flex justify-between font-bold text-xs">
              <span>TOTAL PAID:</span>
              <span className="tabular-nums">{formatINR(grandTotal)}</span>
            </div>

            <div className="mt-1 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="tabular-nums">{paymentMode}</span>
              </div>
              {paymentRef && (
                <div className="flex justify-between">
                  <span>Ref No:</span>
                  <span className="tabular-nums">{paymentRef}</span>
                </div>
              )}
            </div>

            <div className="my-1.5 border-t border-dashed border-gray-400" />

            {/* GST Breakup */}
            {gstSlabs.length > 0 && (
              <>
                <div className="text-center text-[10px] font-bold mb-1">
                  GST BREAKUP DETAILS
                </div>
                <div className="flex justify-between text-[9px] font-bold border-b border-gray-300 pb-0.5">
                  <span className="w-10">GST %</span>
                  <span className="w-14 text-right">Taxable</span>
                  <span className="w-12 text-right">CGST</span>
                  <span className="w-12 text-right">SGST</span>
                  <span className="w-14 text-right">Total</span>
                </div>
                {gstSlabs.map((slab) => (
                  <div key={slab.rate} className="flex justify-between text-[9px]">
                    <span className="w-10 tabular-nums">{slab.rate}%</span>
                    <span className="w-14 text-right tabular-nums">
                      {formatINR(slab.taxable)}
                    </span>
                    <span className="w-12 text-right tabular-nums">
                      {formatINR(slab.cgst)}
                    </span>
                    <span className="w-12 text-right tabular-nums">
                      {formatINR(slab.sgst)}
                    </span>
                    <span className="w-14 text-right tabular-nums">
                      {formatINR(slab.total)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-[9px] font-bold border-t border-gray-300 pt-0.5 mt-0.5">
                  <span className="w-10">Total</span>
                  <span className="w-14 text-right tabular-nums">
                    {formatINR(gstSlabs.reduce((s, r) => s + r.taxable, 0))}
                  </span>
                  <span className="w-12 text-right tabular-nums">
                    {formatINR(gstSlabs.reduce((s, r) => s + r.cgst, 0))}
                  </span>
                  <span className="w-12 text-right tabular-nums">
                    {formatINR(gstSlabs.reduce((s, r) => s + r.sgst, 0))}
                  </span>
                  <span className="w-14 text-right tabular-nums">
                    {formatINR(grandTotal)}
                  </span>
                </div>

                <div className="my-1.5 border-t border-dashed border-gray-400" />

                <div className="text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span className="tabular-nums">{formatINR(taxableValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total GST:</span>
                    <span className="tabular-nums">{formatINR(totalGst)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Invoice Total:</span>
                    <span className="tabular-nums">{formatINR(grandTotal)}</span>
                  </div>
                </div>
              </>
            )}

            <div className="my-1.5 border-t border-dashed border-gray-400" />

            {/* Payment & Footer */}
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

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Action
              color="var(--brand-blue)"
              icon={Printer}
              label="Print Receipt"
              onClick={printReceipt}
            />
            {delivery === "Home" && (
              <Action
                color="var(--brand-orange)"
                icon={Bike}
                label="Assign Rider"
                onClick={() => navigate({ to: "/delivery", search: { orderId } })}
              />
            )}
            <Action color="var(--brand-red)" icon={Plus} label="New Order" to="/new-order" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  color,
  to,
  onClick,
}: {
  icon: typeof Printer;
  label: string;
  color: string;
  to?: string;
  onClick?: () => void;
}) {
  const cls =
    "tap-target-lg flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-sm font-bold text-white shadow-sm active:scale-[0.97]";
  if (to) {
    return (
      <Link to={to as "/new-order"} className={cls} style={{ backgroundColor: color }}>
        <Icon className="h-6 w-6" />
        {label}
      </Link>
    );
  }
  return (
    <button className={cls} style={{ backgroundColor: color }} onClick={onClick}>
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}
