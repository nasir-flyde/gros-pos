import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEffectiveVariantPrice, getPosImageUrl, productApi } from "@/lib/product-api";
import { formatINR } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { useAuthStore } from "@/lib/auth-store";
import { CartPanel } from "@/components/CartPanel";
import { WeightEntryDialog } from "@/components/WeightEntryDialog";
import { formatWeight } from "@/lib/weight";
import {
  buildMarkdownCartProduct,
  buildScannedCartProduct,
  getCameraErrorMessage,
  getScannerCartState,
  normalizeBarcodeInput,
} from "@/lib/scanner-flow";
import { getMarkdownErrorMessage, isMarkdownCode, markdownApi } from "@/lib/markdown-api";
import { ScanLine, Plus, Minus, Camera, CameraOff, Package, Search, X, Zap } from "lucide-react";
import { toast } from "sonner";

type BarcodeDetectorCtor = new (opts?: { formats: string[] }) => {
  detect: (v: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>>;
};
const BcDetector =
  typeof window !== "undefined"
    ? (window as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
    : undefined;

export const Route = createFileRoute("/_pos/scanner")({
  head: () => ({ meta: [{ title: "Scanner" }] }),
  component: ScannerPage,
});

const SUPPORTED_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "qr_code",
  "itf",
  "data_matrix",
];

function ScannerPage() {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [scanningActive, setScanningActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<{
    detect: (v: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>>;
  } | null>(null);
  const detectedRef = useRef(false);
  const { add, inc, dec, items, count, activeOrderId } = useCart();
  const scopes = useAuthStore((s) => s.scopes);
  const storeId = scopes.find((s) => s.type === "store")?.id ?? "";

  const supportsDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
  const hasLookupBarcode = barcodeInput.length >= 6;

  const {
    data: variant,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["barcode", barcodeInput, storeId],
    queryFn: async () => {
      if (!isMarkdownCode(barcodeInput)) {
        const resolved = await productApi.getVariantByBarcode(barcodeInput, storeId);
        return { variant: resolved.data, markdown: null };
      }
      if (activeOrderId) throw new Error("Markdown stock cannot be added to a resumed held order.");
      const markdown = (await markdownApi.resolveLabel(storeId, barcodeInput)).data;
      const variants = await productApi.getStoreVariantStock([markdown.productVariantId], storeId);
      if (!variants[0]) throw new Error("The product for this markdown label is unavailable.");
      if (variants[0].sellingMode === "WEIGHT") {
        throw new Error("Markdown labels for manually weighed products are not supported yet.");
      }
      return { variant: variants[0], markdown };
    },
    enabled: hasLookupBarcode,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const lookupResult = hasLookupBarcode ? variant : undefined;
  const scannedMarkdown = lookupResult?.markdown ?? null;
  const scannedVariant = useMemo(
    () =>
      lookupResult?.variant
        ? {
            ...lookupResult.variant,
            quantityAvailable:
              scannedMarkdown?.remainingQuantity ?? lookupResult.variant.quantityAvailable,
          }
        : null,
    [lookupResult?.variant, scannedMarkdown?.remainingQuantity],
  );
  const scannerCartState = useMemo(
    () => getScannerCartState(scannedVariant, items, scannedMarkdown?.markdownCode),
    [items, scannedMarkdown?.markdownCode, scannedVariant],
  );
  const scannedOutOfStock = scannerCartState.outOfStock;
  const scannedAtStockLimit = scannerCartState.atStockLimit;
  const cartLine = scannerCartState.cartLine;
  const scannedSellPrice =
    scannedMarkdown?.effectivePrice ??
    (scannedVariant ? getEffectiveVariantPrice(scannedVariant) : 0);

  // ── Detection loop (exact same as barcode-scanner) ─────────────────
  const stopDetectionLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setScanningActive(false);
  }, []);

  const startDetectionLoop = useCallback(() => {
    if (!detectorRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setScanningActive(true);
    detectedRef.current = false;

    const tick = async () => {
      const detector = detectorRef.current;
      if (detectedRef.current || !videoRef.current || video.paused || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!detector) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const codes = await detector.detect(canvas);
        if (codes.length > 0 && !detectedRef.current) {
          detectedRef.current = true;
          const code = codes[0].rawValue;
          setBarcodeInput(code);
          setScanningActive(false);
          stopDetectionLoop();
          return;
        }
      } catch {
        /* per-frame errors are normal, keep scanning */
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopDetectionLoop]);

  // ── Camera control ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, [stopDetectionLoop]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera is not available in this browser. Type barcode manually.");
        return;
      }
      if (supportsDetector && !detectorRef.current && BcDetector) {
        detectorRef.current = new BcDetector({ formats: SUPPORTED_FORMATS });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err: unknown) {
      const e = err as { name?: string };
      setCameraError(getCameraErrorMessage(e.name));
    }
  }, [supportsDetector]);

  // Attach stream and start loop once video is ready
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const handleCanPlay = () => {
      video
        .play()
        .then(() => {
          if (supportsDetector) startDetectionLoop();
        })
        .catch(() => setCameraError("Failed to start camera preview."));
    };

    video.addEventListener("canplay", handleCanPlay, { once: true });
    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [cameraActive, supportsDetector, startDetectionLoop]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!scannedVariant && !isFetching && barcodeInput.length === 0) {
      barcodeInputRef.current?.focus({ preventScroll: true });
    }
  }, [barcodeInput.length, isFetching, scannedVariant]);

  // ── On lookup result, stop camera (found or not) ────────────────────
  useEffect(() => {
    if (!isFetching && barcodeInput.length >= 6) {
      // Only stop the camera if the product is NOT found or is out of stock.
      // If it's found and in-stock, we'll auto-add and keep scanning.
      if (!scannedVariant || scannedOutOfStock) {
        stopCamera();
      }
    }
  }, [isFetching, barcodeInput, stopCamera, scannedVariant, scannedOutOfStock]);

  // ── Add to cart ─────────────────────────────────────────────────────
  const addScanned = useCallback(
    (quantity = 1, enteredQuantity?: string) => {
      if (!scannedVariant) return false;
      if (!scannerCartState.canAdd) {
        if (scannerCartState.message) toast.error(scannerCartState.message);
        return false;
      }
      const p = scannedMarkdown
        ? buildMarkdownCartProduct(scannedVariant, scannedMarkdown)
        : buildScannedCartProduct(scannedVariant);
      const added = add(p, quantity, enteredQuantity);
      if (!added) {
        toast.error(`Only ${scannedVariant.quantityAvailable ?? 0} available`);
        return false;
      }
      setBarcodeInput("");
      return true;
    },
    [add, scannedMarkdown, scannedVariant, scannerCartState.canAdd, scannerCartState.message],
  );

  // ── Auto-add to cart on successful scan ──────────────────────────────
  useEffect(() => {
    if (scannedVariant && !isFetching && scannerCartState.canAdd) {
      if (scannedVariant.sellingMode === "WEIGHT" && !scannedMarkdown) {
        setWeightDialogOpen(true);
        stopCamera();
        return;
      }
      if (addScanned()) {
        toast.success(`Added ${scannedVariant.variantName} to cart`);
      }
      // Reset scanner for next item
      detectedRef.current = false;
      if (cameraActive) {
        startDetectionLoop();
      }
    }
  }, [
    scannedVariant,
    isFetching,
    scannerCartState.canAdd,
    addScanned,
    cameraActive,
    startDetectionLoop,
    scannedMarkdown,
    stopCamera,
  ]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Scanner / product area */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[var(--brand-yellow)]" />
            <div>
              <div className="text-sm font-extrabold uppercase tracking-wide text-white">
                Scanner Mode
              </div>
              <div className="text-[11px] text-white/50">
                {cameraActive
                  ? "Point camera at barcode"
                  : cameraError
                    ? "Camera unavailable"
                    : "Tap Start Camera to scan"}
              </div>
            </div>
          </div>
          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className="tap-target flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white active:scale-95"
          >
            {cameraActive ? (
              <>
                <CameraOff className="h-4 w-4" /> Stop
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" /> Start
              </>
            )}
          </button>
        </div>

        {/* ── Camera / Content area ──────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          {/* Video feed (only when camera active and no product found) */}
          {cameraActive && !scannedVariant && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative h-32 w-64 rounded-xl border-2 border-[var(--brand-blue)] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--brand-blue)]/80 animate-scanline" />
                  <span className="absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-[var(--brand-blue)] rounded-tl-sm" />
                  <span className="absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-[var(--brand-blue)] rounded-tr-sm" />
                  <span className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[var(--brand-blue)] rounded-bl-sm" />
                  <span className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[var(--brand-blue)] rounded-br-sm" />
                </div>
                {scanningActive && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1">
                    <Zap className="h-3 w-3 animate-pulse text-[var(--brand-blue)]" />
                    <span className="text-xs font-medium text-white">
                      Scanning automatically...
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Idle state (camera off, no product) */}
          {!cameraActive && !scannedVariant && !isFetching && (
            <div className="grid h-full place-items-center">
              {cameraError ? (
                <div className="text-center">
                  <CameraOff className="mx-auto h-12 w-12 text-red-400" />
                  <div className="mt-3 text-sm font-semibold text-red-300">{cameraError}</div>
                </div>
              ) : (
                <div className="text-center text-white/30">
                  <Camera className="mx-auto h-16 w-16" />
                  <div className="mt-3 text-sm font-bold">Camera is off</div>
                  {!supportsDetector && (
                    <div className="mt-2 text-xs text-white/20">
                      Auto-scan not supported in this browser. Type barcode manually.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Product found — show card matching new-order style */}
          {scannedVariant && !isFetching && (
            <div className="flex h-full flex-col items-center justify-center p-6">
              <div className="w-full max-w-sm rounded-2xl border-2 bg-card p-4 shadow-sm">
                {/* Image */}
                <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-[var(--secondary)]">
                  {getPosImageUrl(scannedVariant) ? (
                    <img
                      src={getPosImageUrl(scannedVariant)}
                      alt={scannedVariant.variantName}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Package className="h-16 w-16 text-muted-foreground/40" />
                  )}
                  {scannedOutOfStock && (
                    <span className="absolute left-2 top-2 rounded-md bg-muted-foreground px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      OUT OF STOCK
                    </span>
                  )}
                </div>
                {/* Details */}
                <div className="mt-3">
                  <div className="text-lg font-extrabold leading-tight">
                    {scannedVariant.variantName}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-muted-foreground">
                    {scannedVariant.unitValue} {scannedVariant.unitType}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-2xl font-extrabold tabular-nums">
                      {formatINR(scannedSellPrice)}
                    </span>
                    {!!scannedVariant.mrp && scannedVariant.mrp > scannedSellPrice && (
                      <span className="text-sm font-semibold text-muted-foreground line-through tabular-nums">
                        {formatINR(scannedVariant.mrp)}
                      </span>
                    )}
                  </div>
                  {scannedMarkdown ? (
                    <div className="mt-2 rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2 text-xs font-bold text-[var(--brand-orange)]">
                      Markdown · Batch {scannedMarkdown.batchNumber} · expires{" "}
                      {new Date(scannedMarkdown.expiryDate).toLocaleDateString("en-IN")} ·{" "}
                      {scannedMarkdown.remainingQuantity} left
                    </div>
                  ) : null}
                </div>
                {/* Actions */}
                {cartLine ? (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                      onClick={() => dec(scannedMarkdown?.markdownCode || scannedVariant._id)}
                      className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--secondary)] active:scale-95"
                    >
                      <Minus className="h-5 w-5" strokeWidth={3} />
                    </button>
                    <span className="min-w-[3rem] text-center text-2xl font-extrabold tabular-nums">
                      {cartLine.qty}
                    </span>
                    <button
                      onClick={() => inc(scannedMarkdown?.markdownCode || scannedVariant._id)}
                      disabled={scannedAtStockLimit}
                      title={
                        scannedAtStockLimit
                          ? "Maximum available stock is already in the cart"
                          : "Increase quantity"
                      }
                      className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--brand-blue)] text-white active:scale-95"
                    >
                      <Plus className="h-5 w-5" strokeWidth={3} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (scannedVariant.sellingMode === "WEIGHT") setWeightDialogOpen(true);
                      else addScanned();
                    }}
                    disabled={!scannerCartState.canAdd}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-green)] py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="h-6 w-6" strokeWidth={3} /> Add to Cart
                  </button>
                )}
              </div>
              {/* Scan again button */}
              <button
                onClick={() => {
                  detectedRef.current = false;
                  setBarcodeInput("");
                  startCamera();
                }}
                className="mt-4 tap-target rounded-xl bg-white/10 px-5 py-2 text-sm font-bold text-white active:scale-95"
              >
                <ScanLine className="mr-1.5 inline h-4 w-4" />
                Scan Another
              </button>
            </div>
          )}

          {/* Manual barcode input */}
          {!scannedVariant && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
              <div className="flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                <Search className="h-5 w-5 shrink-0 text-white/50" />
                <input
                  ref={barcodeInputRef}
                  aria-label="Barcode"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(normalizeBarcodeInput(e.target.value))}
                  placeholder="Or type barcode…"
                  className="w-full bg-transparent text-lg font-extrabold tracking-widest text-white placeholder:text-white/30 focus:outline-none"
                />
                {barcodeInput && (
                  <button
                    onClick={() => setBarcodeInput("")}
                    aria-label="Clear barcode"
                    className="shrink-0 text-white/50 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isFetching && (
            <div className="absolute left-4 right-4 top-4 rounded-2xl bg-white/10 px-6 py-4 text-center backdrop-blur">
              <Package className="mx-auto h-6 w-6 animate-pulse text-white/50" />
              <div className="mt-1 text-sm font-bold text-white">Looking up product…</div>
            </div>
          )}

          {/* Error state */}
          {error && barcodeInput.length >= 6 && !isFetching && !scannedVariant && (
            <div className="absolute left-4 right-4 top-4 rounded-2xl border-2 border-red-500/30 bg-red-500/10 px-6 py-4 text-center backdrop-blur">
              <div className="text-2xl">❌</div>
              <div className="mt-1 text-sm font-bold text-white">
                {isMarkdownCode(barcodeInput) ? "Markdown unavailable" : "Product not found"}
              </div>
              <div className="text-xs text-white/60">
                {isMarkdownCode(barcodeInput)
                  ? getMarkdownErrorMessage(error)
                  : `No variant with barcode "${barcodeInput}"`}
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white"
              >
                Retry Lookup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar — only show when something was scanned */}
      {count > 0 && <CartPanel />}
      {scannedVariant?.sellingMode === "WEIGHT" && !scannedMarkdown ? (
        <WeightEntryDialog
          open={weightDialogOpen}
          productName={scannedVariant.variantName}
          pricePerKg={scannedSellPrice}
          availableKg={
            scannedVariant.quantityAvailable === undefined
              ? undefined
              : Math.max(0, scannedVariant.quantityAvailable - (cartLine?.qty || 0))
          }
          onClose={() => {
            setWeightDialogOpen(false);
            setBarcodeInput("");
            detectedRef.current = false;
          }}
          onConfirm={(kilograms, enteredQuantity) => {
            if (!addScanned(kilograms, enteredQuantity)) return;
            setWeightDialogOpen(false);
            toast.success(`Added ${formatWeight(kilograms)} of ${scannedVariant.variantName}`);
            detectedRef.current = false;
          }}
        />
      ) : null}
    </div>
  );
}
