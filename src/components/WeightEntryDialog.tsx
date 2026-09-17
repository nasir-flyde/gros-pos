import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { calculateWeightLineTotal, formatWeight, parseWeightInput } from "@/lib/weight";

interface WeightEntryDialogProps {
  open: boolean;
  productName: string;
  pricePerKg: number;
  availableKg?: number;
  initialKg?: number;
  actionLabel?: string;
  onClose: () => void;
  onConfirm: (kilograms: number, enteredQuantity: string) => void;
}

export function WeightEntryDialog({
  open,
  productName,
  pricePerKg,
  availableKg,
  initialKg,
  actionLabel = "Add to Cart",
  onClose,
  onConfirm,
}: WeightEntryDialogProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setInput(initialKg ? formatWeight(initialKg).replace(/\s/g, "") : "");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [initialKg, open]);

  const parsed = useMemo(() => parseWeightInput(input), [input]);
  const exceedsStock = Boolean(
    parsed && availableKg !== undefined && parsed.kilograms > availableKg + 0.000001,
  );
  const error =
    input && !parsed
      ? "Enter weight as 250g, 0.250, or 1.75kg (minimum 1g)."
      : exceedsStock
        ? `Only ${formatWeight(availableKg ?? 0)} is available.`
        : "";
  const canConfirm = Boolean(parsed && !exceedsStock);

  if (!open) return null;

  const submit = () => {
    if (!parsed || exceedsStock) return;
    onConfirm(parsed.kilograms, input.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Enter weight for ${productName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border-2 bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Enter Weight</h2>
            <p className="mt-1 font-bold">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg bg-secondary"
            aria-label="Close weight entry"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
          <div>
            <span className="text-muted-foreground">Rate</span>
            <strong className="block">{formatINR(pricePerKg)}/kg</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Available</span>
            <strong className="block">
              {availableKg === undefined ? "—" : formatWeight(availableKg)}
            </strong>
          </div>
        </div>

        <label
          className="mt-4 block text-xs font-bold uppercase text-muted-foreground"
          htmlFor="manual-weight"
        >
          Weight
        </label>
        <input
          ref={inputRef}
          id="manual-weight"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") onClose();
          }}
          placeholder="250g, 0.250, or 1.75kg"
          inputMode="decimal"
          className="mt-1 h-14 w-full rounded-xl border-2 bg-background px-4 text-xl font-extrabold outline-none focus:border-[var(--brand-blue)]"
          aria-invalid={Boolean(error)}
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {["100g", "250g", "500g", "1kg"].map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setInput(quick)}
              className="rounded-lg bg-secondary px-2 py-2 text-sm font-bold"
            >
              {quick}
            </button>
          ))}
        </div>
        <div className="min-h-6 pt-2 text-sm font-semibold text-[var(--brand-red)]" role="alert">
          {error}
        </div>

        <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-[var(--brand-green)]/20 bg-[var(--brand-green)]/5 p-4">
          <span className="font-bold">Calculated amount</span>
          <strong className="text-2xl text-[var(--brand-green)]">
            {parsed && !exceedsStock
              ? formatINR(calculateWeightLineTotal(pricePerKg, parsed.kilograms))
              : "—"}
          </strong>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl bg-secondary font-extrabold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={submit}
            className="h-12 rounded-xl bg-[var(--brand-green)] font-extrabold text-white disabled:opacity-40"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
