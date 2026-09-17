export const SHELF_LABEL_VIEW_PERMISSIONS = ["shelfLabel.read", "shelfLabel.print"] as const;

export function canViewShelfLabels(permissions: readonly string[], isSuperAdmin = false): boolean {
  return (
    isSuperAdmin ||
    SHELF_LABEL_VIEW_PERMISSIONS.some((permission) => permissions.includes(permission))
  );
}

export function canPrintShelfLabels(permissions: readonly string[], isSuperAdmin = false): boolean {
  return isSuperAdmin || permissions.includes("shelfLabel.print");
}
