import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatINR = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "₹0";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};
