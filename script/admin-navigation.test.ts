import test from "node:test";
import assert from "node:assert/strict";
import { allowedAdminTabs, resolveAdminTab } from "../client/src/lib/admin-navigation";

const denied = { canManageProducts: false, canManageStock: false, canManageOrders: false, canManageCoupons: false, canAccessPOS: false };
const ordersOnly = { permissions: { ...denied, canManageOrders: true } };

test("orders-only login and forged Products hash resolve before content rendering", () => {
  const tabs = allowedAdminTabs(ordersOnly);
  assert.deepEqual(tabs, ["Overview", "Orders", "Transactions"]);
  assert.equal(resolveAdminTab("Products", tabs), "Orders");
  assert.equal(resolveAdminTab("Admin Management", tabs), "Orders");
  assert.equal(resolveAdminTab("Transactions", tabs), "Transactions");
  assert.equal(resolveAdminTab("Overview", tabs), "Overview");
});

test("identity and permission changes cannot retain unauthorized content", () => {
  const products = allowedAdminTabs({ permissions: { ...denied, canManageProducts: true } });
  assert.equal(resolveAdminTab("Products", products), "Products");
  assert.equal(resolveAdminTab("Products", allowedAdminTabs(ordersOnly)), "Orders");
  assert.equal(resolveAdminTab("Orders", allowedAdminTabs({ permissions: denied })), "Overview");
  assert.equal(resolveAdminTab("Products", allowedAdminTabs(null)), null);
});

test("super admins retain all tabs; legacy permissions never confer account management", () => {
  const superTabs = allowedAdminTabs({ isSuperAdmin: true, permissions: denied });
  for (const tab of superTabs) assert.equal(resolveAdminTab(tab, superTabs), tab);
  assert.equal(superTabs.length, 8);
  assert.equal(resolveAdminTab("Admin Management", superTabs), "Admin Management");
  const legacy = allowedAdminTabs({ permissions: null });
  assert.ok(legacy.includes("Products"));
  assert.ok(!legacy.includes("Admin Management"));
});