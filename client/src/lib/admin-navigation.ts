import type { AdminPermissions } from "./auth";

export type AdminTab = "Overview" | "Analytics" | "Finance" | "Accounting" | "Charts" | "Products" | "Inventory" | "POS" | "Orders" | "Customers" | "Logistics" | "Quotations" | "Purchase Orders" | "Transactions" | "Coupons" | "Admin Management";
type NavigationAdmin = { isSuperAdmin?: boolean; permissions?: AdminPermissions | null };

/** One permission-derived list drives navigation and render-time content gating. */
export function allowedAdminTabs(admin: NavigationAdmin | null): AdminTab[] {
  if (!admin) return [];
  const allowed = (permission: keyof AdminPermissions) =>
    admin.isSuperAdmin === true || admin.permissions?.[permission] === true;
  return [
    "Overview",
    ...(allowed("canManageProducts") ? ["Products" as const] : []),
    ...(allowed("canManageStock") ? ["Inventory" as const, "Purchase Orders" as const] : []),
    ...(allowed("canAccessPOS") ? ["POS" as const] : []),
    ...(allowed("canManageOrders") ? ["Orders" as const, "Customers" as const, "Logistics" as const, "Quotations" as const, "Transactions" as const, "Analytics" as const, "Finance" as const, "Charts" as const] : []),
    ...(admin.isSuperAdmin === true ? ["Accounting" as const] : []),
    ...(allowed("canManageCoupons") ? ["Coupons" as const] : []),
    ...(admin.isSuperAdmin === true ? ["Admin Management" as const] : []),
  ];
}

/** Resolve synchronously during render, not just in an effect after controls mount. */
export function resolveAdminTab(requested: string, allowed: readonly AdminTab[]): AdminTab | null {
  if (allowed.includes(requested as AdminTab)) return requested as AdminTab;
  return allowed.find(tab => tab !== "Overview") ?? allowed[0] ?? null;
}