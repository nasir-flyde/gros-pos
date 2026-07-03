import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ReceiptPrintContent } from "@/components/receipt/receipt-print-content";
import type { NormalizedReceipt } from "@/lib/receipt";

const PRINT_ROOT_ID = "pos-receipt-print-root";
const PRINT_STYLE_ID = "pos-receipt-print-style";

const PRINT_STYLES = `
  @media screen {
    #${PRINT_ROOT_ID} {
      display: none !important;
    }
  }

  @media print {
    @page {
      size: 80mm auto;
      margin: 0;
    }

    body > * {
      visibility: hidden !important;
    }

    #${PRINT_ROOT_ID},
    #${PRINT_ROOT_ID} * {
      visibility: visible !important;
    }

    #${PRINT_ROOT_ID} {
      display: block !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 80mm !important;
      min-height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      background: #fff !important;
    }

    #${PRINT_ROOT_ID} [data-receipt-print-content] {
      width: 72mm !important;
      max-width: 72mm !important;
      padding: 2mm 4mm !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      font-family: "Courier New", "Consolas", monospace !important;
      font-size: 10px !important;
      line-height: 1.3 !important;
      color: #000 !important;
      background: #fff !important;
    }

    #${PRINT_ROOT_ID} .tabular-nums {
      font-variant-numeric: tabular-nums;
    }
  }
`;

const nextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });

export async function printNormalizedReceipt(receipt: NormalizedReceipt): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const existingRoot = document.getElementById(PRINT_ROOT_ID);
  if (existingRoot) {
    existingRoot.remove();
  }

  const existingStyle = document.getElementById(PRINT_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.id = PRINT_ROOT_ID;
  document.body.appendChild(container);

  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <div className="bg-white p-6">
        <ReceiptPrintContent receipt={receipt} />
      </div>,
    );
  });

  await nextFrame();

  return new Promise<boolean>((resolve) => {
    let finished = false;

    const cleanup = (result: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", handleAfterPrint);
      root.unmount();
      container.remove();
      style.remove();
      resolve(result);
    };

    const handleAfterPrint = () => {
      window.setTimeout(() => cleanup(true), 0);
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });

    try {
      window.print();
      window.setTimeout(() => cleanup(true), 1000);
    } catch {
      cleanup(false);
    }
  });
}
