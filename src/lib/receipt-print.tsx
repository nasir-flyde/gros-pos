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

    #${PRINT_ROOT_ID} [data-backend-receipt-html] {
      width: 80mm !important;
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
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 1.35 !important;
      color: #000 !important;
      background: #fff !important;
      opacity: 1 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /*
     * Backend receipts and the React fallback both contain muted gray utility
     * classes. Thermal printers reproduce those grays as faint dot patterns,
     * so print every receipt child as full black at a reliable minimum weight.
     */
    #${PRINT_ROOT_ID} [data-receipt-print-content] * {
      color: #000 !important;
      border-color: #000 !important;
      opacity: 1 !important;
      font-weight: 600 !important;
      text-shadow: none !important;
    }

    #${PRINT_ROOT_ID} [data-receipt-print-content] :is(
      strong,
      b,
      th,
      h1,
      h2,
      h3,
      .font-bold,
      .font-extrabold
    ) {
      font-weight: 800 !important;
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

function createPrintContainer() {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.id = PRINT_ROOT_ID;
  document.body.appendChild(container);

  return { container, style };
}

async function printMountedReceipt(
  container: HTMLElement,
  style: HTMLStyleElement,
  dispose?: () => void,
): Promise<boolean> {
  await nextFrame();

  return new Promise<boolean>((resolve) => {
    let finished = false;

    const cleanup = (result: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("afterprint", handleAfterPrint);
      dispose?.();
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

export async function printReceiptHtml(receiptHtml: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined" || !receiptHtml.trim()) {
    return false;
  }

  const { container, style } = createPrintContainer();

  try {
    const parsed = new DOMParser().parseFromString(receiptHtml, "text/html");
    const wrapper = document.createElement("div");

    for (const attribute of parsed.body.attributes) {
      wrapper.setAttribute(attribute.name, attribute.value);
    }

    wrapper.setAttribute("data-backend-receipt-html", "");

    parsed.head.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
    });

    while (parsed.body.firstChild) {
      wrapper.appendChild(parsed.body.firstChild);
    }

    if (!wrapper.querySelector("[data-receipt-print-content]")) {
      wrapper.setAttribute("data-receipt-print-content", "");
    }

    container.appendChild(wrapper);
    return await printMountedReceipt(container, style);
  } catch {
    container.remove();
    style.remove();
    return false;
  }
}

export async function printNormalizedReceipt(receipt: NormalizedReceipt): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const { container, style } = createPrintContainer();

  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <div className="bg-white p-6">
        <ReceiptPrintContent receipt={receipt} />
      </div>,
    );
  });

  return printMountedReceipt(container, style, () => root.unmount());
}
