import jsPDF from "jspdf";

const FONT = "Courier";
const FONT_BOLD = "Courier-Bold";
const FONT_SIZE = 8;
const LH = 4; // line height in mm
const SM = 3.5;
const ML = 15; // margin left
const PW = 210; // A4 width
const CW = PW - ML * 2; // content width

export function generateReceiptPdf(r: Record<string, unknown>) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  const data = r as unknown as ReceiptData;

  let y = 25;

  function txt(text: string, opts?: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; x?: number; spacing?: number }) {
    if (!text) { y += opts?.spacing ?? LH; return; }
    const size = opts?.size ?? FONT_SIZE;
    const f = opts?.bold ? FONT_BOLD : FONT;
    doc.setFont(f, "normal");
    doc.setFontSize(size);
    const tw = doc.getTextWidth(text);
    let dx = opts?.x ?? ML;
    if (opts?.align === "center") dx = (PW - tw) / 2;
    else if (opts?.align === "right") dx = PW - ML - tw;
    doc.text(text, dx, y);
    y += opts?.spacing ?? LH;
  }

  function hr() {
    doc.setLineWidth(0.2);
    doc.line(ML, y, ML + CW, y);
    y += LH;
  }

  function hrDash() {
    doc.setLineWidth(0.15);
    for (let i = 0; i < CW; i += 5) {
      doc.line(ML + i, y, Math.min(ML + i + 2.5, ML + CW), y);
    }
    y += LH;
  }

  const fmt = (n: number | null | undefined) => {
    if (n == null || Number.isNaN(n)) return "0.00";
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function splitText(text: string, width: number, size = FONT_SIZE - 1) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(text || "", width) as string[];
  }

  // ── Store Header ──
  txt(data.storeName, { size: 14, bold: true, align: "center", spacing: SM });
  if (data.orgLegalName) txt(data.orgLegalName, { size: 10, align: "center", spacing: SM + 1 });
  if (data.addressStr) txt(data.addressStr, { size: 7, align: "center", spacing: SM });
  if (data.cityLine) txt(data.cityLine, { size: 7, align: "center", spacing: SM + 1 });
  let reg = "";
  if (data.orgGstin) reg += `GSTIN : ${data.orgGstin}`;
  if (data.cinNumber) reg += (reg ? "  " : "") + `CIN : ${data.cinNumber}`;
  if (data.fssaiLicense) reg += (reg ? "\n" : "") + `FSSAI LIC NO : ${data.fssaiLicense}`;
  if (reg) {
    for (const line of reg.split("\n")) txt(line, { size: 7, align: "center", spacing: SM + 1 });
  }

  hrDash();
  txt("TAX INVOICE", { size: 11, bold: true, align: "center" });
  hrDash();

  txt(`Invoice No : ${data.invoiceNumber}`, { size: FONT_SIZE - 1 });
  const dt = `${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
  txt(dt, { size: FONT_SIZE - 1, spacing: SM });
  let meta = "";
  if (data.storeCode) meta += `Store Code : ${data.storeCode}`;
  if (data.cashierName) meta += (meta ? "  " : "") + `Cashier : ${data.cashierName}`;
  if (meta) txt(meta, { size: FONT_SIZE - 1 });
  hr();

  // ── Items ──
  const c1 = 14, c2 = 60, c3 = 12, c4 = 20, c5 = 20;
  function itemHeader() {
    txt(
      pad("HSN", c1) + pad("Item", c2) + pad("Qty", c3, "r") + pad("Rate", c4, "r") + pad("Amount", c5, "r"),
      { bold: true, size: FONT_SIZE - 1 },
    );
    hr();
  }
  itemHeader();

  const x1 = ML;
  const x2 = x1 + c1;
  const x3 = x2 + c2;
  const x4 = x3 + c3;
  const x5 = x4 + c4;

  for (const item of data.itemsWithGst as Array<Record<string, unknown>>) {
    const hsn = ((item.hsnCode as string) || "").slice(0, 6);
    const name = (item.variantName as string) || "";
    const qty = String(item.quantity ?? 1);
    const rate = fmt(item.unitPrice as number);
    const amt = fmt(item.lineTotal as number);
    const wrappedName = splitText(name, c2, FONT_SIZE - 1);

    doc.setFont(FONT, "normal");
    doc.setFontSize(FONT_SIZE - 1);
    doc.text(hsn, x1, y);
    doc.text(wrappedName[0] || "", x2, y);
    doc.text(qty, x3 + c3, y, { align: "right" });
    doc.text(rate, x4 + c4, y, { align: "right" });
    doc.text(amt, x5 + c5, y, { align: "right" });
    y += LH + 1;

    for (const line of wrappedName.slice(1)) {
      doc.text(line, x2, y);
      y += LH;
    }

    const taxRate = (item.taxRate as number) || 0;
    if (taxRate > 0) {
      const half = taxRate / 2;
      const c = (item.cgst as number) || 0;
      const s = (item.sgst as number) || 0;
      txt(`  CGST @${half}%: ${fmt(c)}  SGST @${half}%: ${fmt(s)}`, { size: 6, spacing: SM });
    }
  }

  hrDash();

  // ── Summary ──
  const s = data;
  txt(`Total Items : ${s.itemCount}`);
  txt(`Gross Amount`, { align: "right", x: ML });
  txt(`  ${fmt(s.grossAmount as number)}`, { align: "right" });
  if (s.discount && (s.discount as number) > 0) {
    const label = s.discountPercent && (s.discountPercent as number) > 0
      ? `Discount @ ${s.discountPercent}%`
      : "Discount";
    txt(label, { align: "right", x: ML });
    txt(`  -${fmt(s.discount as number)}`, { align: "right" });
  }
  txt(`Net Sales Value`, { align: "right", x: ML });
  txt(`  ${fmt(s.netSalesValue as number)}`, { align: "right" });
  txt(`CGST`, { align: "right", x: ML });
  txt(`  ${fmt(s.totalCgst as number)}`, { align: "right" });
  txt(`SGST`, { align: "right", x: ML });
  txt(`  ${fmt(s.totalSgst as number)}`, { align: "right" });

  hr();
  txt("TOTAL PAID", { bold: true, size: 11, align: "right", x: ML });
  txt(`  ${fmt(s.grandTotal as number)}`, { bold: true, size: 11, align: "right" });

  y += SM;
  txt(`Payment Mode : ${s.paymentMode}${s.paymentRef ? `  Ref No: ${s.paymentRef}` : ""}`, { size: FONT_SIZE - 1 });

  // ── GST Breakup ──
  const gstByRate = s.gstByRate as Record<string, { taxable: number; cgst: number; sgst: number }> | undefined;
  if (gstByRate && Object.keys(gstByRate).length > 0) {
    hrDash();
    txt("GST BREAKUP DETAILS", { bold: true, align: "center" });

    const gc1 = 16, gc2 = 28, gc3 = 22, gc4 = 22, gc5 = 24;
    txt(
      pad("GST %", gc1) + pad("Taxable", gc2, "r") + pad("CGST", gc3, "r") +
      pad("SGST", gc4, "r") + pad("Total", gc5, "r"),
      { bold: true, size: 7 },
    );
    hr();

    const slabs = Object.entries(gstByRate)
      .map(([rate, vals]) => ({
        rate: Number(rate),
        ...vals,
        total: vals.taxable + vals.cgst + vals.sgst,
      }))
      .sort((a, b) => a.rate - b.rate);

    for (const slab of slabs) {
      txt(
        pad(`${slab.rate}%`, gc1) + pad(fmt(slab.taxable), gc2, "r") +
        pad(fmt(slab.cgst), gc3, "r") + pad(fmt(slab.sgst), gc4, "r") +
        pad(fmt(slab.total), gc5, "r"),
        { size: 7 },
      );
    }

    hr();
    txt(
      pad("Total", gc1) + pad(fmt(s.taxableValue as number), gc2, "r") +
      pad(fmt(s.totalCgst as number), gc3, "r") + pad(fmt(s.totalSgst as number), gc4, "r") +
      pad(fmt(s.grandTotal as number), gc5, "r"),
      { bold: true, size: 7 },
    );

    hrDash();
    txt(`Taxable Value    ${fmt(s.taxableValue as number)}`);
    txt(`Total GST        ${fmt(s.totalGst as number)}`);
    txt(`Invoice Total   ${fmt(s.grandTotal as number)}`, { bold: true, size: 10 });
  }

  hrDash();
  y += SM;
  txt("Thank You For Shopping With Us", { bold: true, size: 10, align: "center", spacing: SM + 2 });
  if (data.storePhone) txt(`Customer Care : ${data.storePhone}`, { size: 7, align: "center", spacing: SM });
  if (data.orgEmail) txt(`Email : ${data.orgEmail}`, { size: 7, align: "center", spacing: SM + 1 });
  txt("Goods once sold will not be taken back unless", { size: 6, align: "center", spacing: SM });
  txt("covered under applicable return policy.", { size: 6, align: "center", spacing: SM });
  txt("Amount shown above is inclusive of GST.", { size: 6, align: "center", spacing: SM });
  txt("This is a computer generated invoice.", { size: 6, align: "center", spacing: SM + 2 });
  txt("***** VISIT AGAIN *****", { bold: true, size: 9, align: "center" });

  return doc.output("arraybuffer");
}

function pad(text: string, width: number, align: "l" | "r" = "l") {
  const str = String(text ?? "");
  const approx = Math.round(width / (FONT_SIZE * 0.19));
  if (str.length >= approx) return str.slice(0, approx);
  const spaces = " ".repeat(approx - str.length);
  return align === "r" ? spaces + str : str + spaces;
}

interface ReceiptData {
  storeName: string;
  addressStr: string;
  cityLine: string;
  storePhone: string;
  storeCode: string;
  orgLegalName: string;
  orgGstin: string;
  fssaiLicense: string;
  cinNumber: string;
  orgEmail: string;
  invoiceNumber: string;
  cashierName: string;
  customerName: string;
  itemCount: number;
  totalQty: number;
  grossAmount: number;
  discount: number;
  discountPercent: number;
  netSalesValue: number;
  grandTotal: number;
  paymentMode: string;
  paymentRef: string;
  totalCgst: number;
  totalSgst: number;
  totalGst: number;
  taxableValue: number;
  gstByRate: Record<string, { taxable: number; cgst: number; sgst: number }>;
  itemsWithGst: Array<{
    variantName: string;
    sku: string;
    hsnCode: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    taxRate: number;
    cgst: number;
    sgst: number;
  }>;
  gstSlabs: Array<{ rate: number; taxable: number; cgst: number; sgst: number; total: number }>;
  delivery: string;
  orderId: string;
  total: number;
}
