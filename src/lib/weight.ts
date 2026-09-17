import { roundCurrency } from "./order-payload";

export const GRAMS_PER_KG = 1000;
export const MIN_WEIGHT_KG = 0.001;

export interface ParsedWeight {
  kilograms: number;
  grams: number;
  originalInput: string;
}

export function normalizeKg(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * GRAMS_PER_KG) / GRAMS_PER_KG;
}

export function parseWeightInput(input: string): ParsedWeight | null {
  const originalInput = input.trim();
  const normalized = originalInput.toLowerCase().replace(/\s+/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?|\.\d+)(kg|kgs|g|gm|gms)?$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2] || "kg";
  if (!Number.isFinite(value) || value <= 0) return null;

  const rawKg = unit.startsWith("g") ? value / GRAMS_PER_KG : value;
  const kilograms = normalizeKg(rawKg);
  if (kilograms < MIN_WEIGHT_KG || Math.abs(rawKg - kilograms) > 0.0000001) return null;

  return { kilograms, grams: Math.round(kilograms * GRAMS_PER_KG), originalInput };
}

export function formatWeight(kilograms: number): string {
  const normalized = normalizeKg(kilograms);
  if (normalized < 1) return `${Math.round(normalized * GRAMS_PER_KG)} g`;
  return `${normalized.toLocaleString("en-IN", { maximumFractionDigits: 3 })} kg`;
}

export function calculateWeightLineTotal(pricePerKg: number, kilograms: number): number {
  return roundCurrency(Number(pricePerKg || 0) * normalizeKg(kilograms));
}
