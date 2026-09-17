export const PACK_BREAKDOWN_PERMISSIONS = [
  "inventory.conversion.read",
  "inventory.conversion.write",
  "store.inventory.read",
] as const;

export function canUsePackBreakdown(permissions: readonly string[], isSuperAdmin = false) {
  return (
    isSuperAdmin ||
    PACK_BREAKDOWN_PERMISSIONS.every((permission) => permissions.includes(permission))
  );
}

export function calculateExpectedOutput(
  sourceQuantity: number,
  ruleSourceQuantity: number,
  ruleOutputQuantity: number,
  targetMode: "FIXED" | "WEIGHT",
) {
  if (sourceQuantity <= 0 || ruleSourceQuantity <= 0 || ruleOutputQuantity <= 0) return 0;
  const result = (sourceQuantity * ruleOutputQuantity) / ruleSourceQuantity;
  return targetMode === "FIXED" ? Math.round(result) : Math.round(result * 1000) / 1000;
}

export function requiresLossReason(actualOutput: number, expectedOutput: number) {
  return actualOutput > 0 && actualOutput < expectedOutput;
}
