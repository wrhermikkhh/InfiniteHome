import type { AdminPermissions } from "./auth";
import { effectiveAdminPermission } from "@shared/admin-permissions";

export type AdminTab = "Overview" | "Analytics" | "Finance" | "Accounting" | "Charts" | "Products" | "Inventory" | "POS" | "Orders" | "Customers" | "Logistics" | "Quotations" | "Purchase Orders" | "Transactions" | "Coupons" | "Admin Management";
type NavigationAdmin = { isSuperAdmin?: boolean; permissions?: AdminPermissions | null };

/** One permission-derived list drives navigation and render-time content gating. */
export function allowedAdminTabs(admin: NavigationAdmin | null): AdminTab[] {
  if (!admin) return [];
  const allowed = (permission: keyof AdminPermissions) =>
    effectiveAdminPermission(admin, permission);
  return [
    "Overview",
    ...(allowed("canManageProducts") ? ["Products" as const] : []),
    ...(allowed("canManageStock") ? ["Inventory" as const] : []),
    ...(allowed("canManageStock") && allowed("canManagePurchaseOrders") ? ["Purchase Orders" as const] : []),
    ...(allowed("canAccessPOS") ? ["POS" as const] : []),
    ...(allowed("canManageOrders") ? ["Orders" as const, "Customers" as const, "Logistics" as const, "Transactions" as const] : []),
    ...(allowed("canManageOrders") && allowed("canManageQuotations") ? ["Quotations" as const] : []),
    ...(allowed("canManageOrders") && allowed("canViewAnalytics") ? ["Analytics" as const, "Charts" as const] : []),
    ...(allowed("canManageOrders") && allowed("canViewFinance") ? ["Finance" as const] : []),
    ...(admin.isSuperAdmin === true ? ["Accounting" as const] : []),
    ...(allowed("canManageCoupons") ? ["Coupons" as const] : []),
    ...(admin.isSuperAdmin === true ? ["Admin Management" as const] : []),
  ];
}

export function hasAdminReportsAccess(allowed: readonly AdminTab[]): boolean {
  return allowed.includes("Analytics") || allowed.includes("Finance");
}

/** Resolve synchronously during render, not just in an effect after controls mount. */
export function resolveAdminTab(requested: string, allowed: readonly AdminTab[]): AdminTab | null {
  if (allowed.includes(requested as AdminTab)) return requested as AdminTab;
  return allowed.find(tab => tab !== "Overview") ?? allowed[0] ?? null;
}