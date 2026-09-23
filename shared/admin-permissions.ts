export const BASE_ADMIN_PERMISSIONS = {
  canManageProducts: true,
  canManageStock: true,
  canManageOrders: true,
  canManageCoupons: true,
  canAccessPOS: true,
} as const;

// Existing accounts inherit these areas from their former parent permission
// until a super-admin explicitly saves a separate choice for each area.
export const LEGACY_PERMISSION_PARENTS = {
  canManageQuotations: "canManageOrders",
  canManagePurchaseOrders: "canManageStock",
  canViewFinance: "canManageOrders",
  canViewAnalytics: "canManageOrders",
} as const;

export type AdminPermissionKey = keyof typeof BASE_ADMIN_PERMISSIONS | keyof typeof LEGACY_PERMISSION_PARENTS;
export type AdminPermissions = Record<AdminPermissionKey, boolean>;

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  ...BASE_ADMIN_PERMISSIONS,
  canManageQuotations: true,
  canManagePurchaseOrders: true,
  canViewFinance: true,
  canViewAnalytics: true,
};

export const ADMIN_PERMISSION_OPTIONS: { key: AdminPermissionKey; label: string }[] = [
  { key: "canManageProducts", label: "Products" },
  { key: "canManageStock", label: "Inventory & stock" },
  { key: "canManageOrders", label: "Orders" },
  { key: "canManageCoupons", label: "Coupons" },
  { key: "canAccessPOS", label: "Point of sale" },
  { key: "canManageQuotations", label: "Quotations" },
  { key: "canManagePurchaseOrders", label: "Purchase orders" },
  { key: "canViewFinance", label: "Finance overview" },
  { key: "canViewAnalytics", label: "Analytics & charts" },
];

export function effectiveAdminPermission(
  admin: { isSuperAdmin?: boolean | null; permissions?: Partial<AdminPermissions> | null } | null,
  permission: string,
): boolean {
  if (!admin) return false;
  if (admin.isSuperAdmin === true) return true;
  if (permission === "super") return false;
  const parent = LEGACY_PERMISSION_PARENTS[permission as keyof typeof LEGACY_PERMISSION_PARENTS];
  if (parent && admin.permissions?.[parent] !== true) return false;
  const value = admin.permissions?.[permission as AdminPermissionKey];
  if (value !== undefined) return value === true;
  return !!parent;
}

export function resolvedAdminPermissions(permissions: Partial<AdminPermissions> | null | undefined): AdminPermissions {
  return Object.fromEntries(ADMIN_PERMISSION_OPTIONS.map(({ key }) => {
    const value = permissions?.[key];
    if (value !== undefined) return [key, value === true];
    const parent = LEGACY_PERMISSION_PARENTS[key as keyof typeof LEGACY_PERMISSION_PARENTS];
    return [key, !!parent && permissions?.[parent] === true];
  })) as AdminPermissions;
}