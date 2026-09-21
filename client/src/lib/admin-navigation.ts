import type { AdminPermissions } from "./auth";

export type AdminTab = "Overview" | "Products" | "Inventory" | "POS" | "Orders" | "Transactions" | "Coupons" | "Admin Management";
type NavigationAdmin = { isSuperAdmin?: boolean; permissions?: AdminPermissions | null };

/** One permission-derived list drives navigation and render-time content gating. */
export function allowedAdminTabs(admin: NavigationAdmin | null): AdminTab[] {
  if (!admin) return [];
  const allowed = (permission: keyof AdminPermissions) =>
    admin.isSuperAdmin === true || admin.permissions == null || admin.permissions[permission] === true;
  return [
    "Overview",
    ...(allowed("canManageProducts") ? ["Products" as const] : []),
    ...(allowed("canManageStock") ? ["Inventory" as const] : []),
    ...(allowed("canAccessPOS") ? ["POS" as const] : []),
    ...(allowed("canManageOrders") ? ["Orders" as const, "Transactions" as const] : []),
    ...(allowed("canManageCoupons") ? ["Coupons" as const] : []),
    ...(admin.isSuperAdmin === true ? ["Admin Management" as const] : []),
  ];
}

/** Resolve synchronously during render, not just in an effect after controls mount. */
export function resolveAdminTab(requested: string, allowed: readonly AdminTab[]): AdminTab | null {
  if (allowed.includes(requested as AdminTab)) return requested as AdminTab;
  return allowed.find(tab => tab !== "Overview") ?? allowed[0] ?? null;
}