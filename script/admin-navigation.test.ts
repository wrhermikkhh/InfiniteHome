import test from "node:test";
import assert from "node:assert/strict";
import { allowedAdminTabs, resolveAdminTab } from "../client/src/lib/admin-navigation";

const denied = { canManageProducts: false, canManageStock: false, canManageOrders: false, canManageCoupons: false, canAccessPOS: false };
const ordersOnly = { permissions: { ...denied, canManageOrders: true } };

test("orders-only login and forged Products hash resolve before content rendering", () => {
  const tabs = allowedAdminTabs(ordersOnly);
  assert.deepEqual(tabs, ["Overview", "Orders", "Customers", "Logistics", "Quotations", "Transactions", "Analytics", "Finance", "Charts"]);
  assert.equal(resolveAdminTab("Products", tabs), "Orders");
  assert.equal(resolveAdminTab("Admin Management", tabs), "Orders");
  assert.equal(resolveAdminTab("Accounting", tabs), "Orders");
  assert.equal(resolveAdminTab("Transactions", tabs), "Transactions");
  assert.equal(resolveAdminTab("Finance", tabs), "Finance");
  assert.equal(resolveAdminTab("Customers", tabs), "Customers");
  assert.equal(resolveAdminTab("Logistics", tabs), "Logistics");
  assert.equal(resolveAdminTab("Quotations", tabs), "Quotations");
  assert.equal(resolveAdminTab("Purchase Orders", tabs), "Orders");
  assert.equal(resolveAdminTab("Overview", tabs), "Overview");
  assert.ok(!tabs.includes("Accounting"));
});

test("identity and permission changes cannot retain unauthorized content", () => {
  const products = allowedAdminTabs({ permissions: { ...denied, canManageProducts: true } });
  assert.equal(resolveAdminTab("Products", products), "Products");
  const stock = allowedAdminTabs({ permissions: { ...denied, canManageStock: true } });
  assert.ok(stock.includes("Purchase Orders"));
  assert.ok(!stock.includes("Quotations"));
  assert.equal(resolveAdminTab("Products", allowedAdminTabs(ordersOnly)), "Orders");
  assert.equal(resolveAdminTab("Orders", allowedAdminTabs({ permissions: denied })), "Overview");
  assert.equal(resolveAdminTab("Products", allowedAdminTabs(null)), null);
});

test("super admins retain all tabs; missing permissions fail closed", () => {
  const superTabs = allowedAdminTabs({ isSuperAdmin: true, permissions: denied });
  for (const tab of superTabs) assert.equal(resolveAdminTab(tab, superTabs), tab);
  assert.equal(superTabs.length, 16);
  assert.ok(superTabs.includes("Accounting"));
  assert.equal(resolveAdminTab("Admin Management", superTabs), "Admin Management");
  const legacy = allowedAdminTabs({ permissions: null });
  assert.deepEqual(legacy, ["Overview"]);
  assert.ok(!legacy.includes("Admin Management"));
  assert.equal(resolveAdminTab("Accounting", legacy), "Overview");
});