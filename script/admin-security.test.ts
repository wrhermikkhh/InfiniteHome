import test from "node:test";
import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { adminPermissionForRoute, getAuthenticatedAdmin, hasAdminPermission, registerAdminSecurity } from "../shared/admin-security";
import { registerAdminAuth } from "../shared/admin-auth";

const dialect = new PgDialect();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const salt = "ab".repeat(16);
const password = `${scryptSync("correct-password", salt, 64).toString("hex")}.${salt}`;
const permissions = { canManageProducts: false, canManageStock: false, canManageOrders: true, canManageCoupons: false, canAccessPOS: false };
function mockDb(arrayShape = false) {
  const admin = { id: "admin-1", name: "Operator", email: "operator@example.test", password, isSuperAdmin: false, permissions };
  const sessions = new Map<string, { admin: any; fingerprint: string; expired: boolean }>();
  const limits = new Map<string, number>();
  const customerSessions = new Map<string, any>();
  const customer = { id: "customer-1", email: "customer@example.test" };
  const emailProofs = new Map<string, { email: string; codeHash: string | null; verified: boolean; expired: boolean }>();
  const queries: string[] = [];
  let resetToken: string | null = null;
  return { admin, sessions, limits, queries, customerSessions, customer, emailProofs, execute: async (query: any) => {
    const { sql, params } = dialect.sqlToQuery(query);
    queries.push(sql);
    let rows: any[] = [];
    if (sql.includes("INSERT INTO customer_email_proofs")) {
      const old = emailProofs.get(params[0] as string);
      emailProofs.set(params[0] as string, { email: params[1] as string, codeHash: params[2] as string, expired: false, verified: old?.email === params[1] && old.verified || false });
    } else if (sql.includes("UPDATE customer_email_proofs")) {
      const proof = emailProofs.get(params[0] as string);
      if (proof && proof.email === params[1] && proof.codeHash === params[2] && !proof.expired) {
        proof.verified = true; proof.codeHash = null; rows = [{ customer_id: params[0] }];
      }
    } else if (sql.includes("FROM customer_email_proofs")) {
      const proof = emailProofs.get(params[0] as string);
      if (proof?.verified && proof.email === params[1]) rows = [{ customer_id: params[0] }];
    } else if (sql.includes("INSERT INTO customer_sessions")) {
      customerSessions.set(params[0] as string, customer);
    } else if (sql.includes("JOIN customers c")) {
      const current = customerSessions.get(params[0] as string);
      if (current) rows = [current];
    } else if (sql.includes("DELETE FROM customer_sessions")) {
      customerSessions.delete(params[0] as string);
    } else if (sql.includes("FROM customer_addresses")) {
      if (params[0] === "address-1" && params[1] === customer.id) rows = [{ id: "address-1" }];
    } else if (sql.includes("INSERT INTO admin_auth_limits") || sql.includes("INSERT INTO admin_auth_throttle")) {
      const key = params[0] as string;
      const count = (limits.get(key) || 0) + 1;
      limits.set(key, count);
      rows = [{ attempts: count }];
    } else if (sql.includes("JOIN admins a")) {
      const session = sessions.get(params[0] as string);
      if (session && !session.expired && session.fingerprint === admin.password) rows = [{ ...session.admin, password_fingerprint: hash(session.fingerprint) }];
    } else if (sql.includes("FROM admins WHERE lower(email)")) {
      if (params[0] === admin.email) rows = [admin];
    } else if (sql.includes("INSERT INTO admin_sessions")) {
      sessions.set(params[0] as string, { admin, fingerprint: admin.password, expired: false });
    } else if (sql.includes("DELETE FROM admin_sessions")) {
      sessions.delete(params[0] as string);
    } else if (sql.includes("SET reset_token =")) {
      resetToken = params[0] as string;
    } else if (sql.includes("UPDATE admins SET password")) {
      if (params[1] === admin.email && params[2] === resetToken) {
        admin.password = params[0] as string; resetToken = null; rows = [{ id: admin.id }];
      }
    } else throw new Error(`Unexpected query: ${sql}`);
    return arrayShape ? rows : { rows };
  }};
}
async function harness(arrayShape = false) {
  const db = mockDb(arrayShape);
  const app = express();
  app.use(express.json());
  const sentCodes: string[] = [];
  const sentEmails: { email: string; purpose?: string; code: string }[] = [];
  registerAdminAuth(app, () => db);
  registerAdminSecurity(app, () => db, async (email, _name, otp, purpose) => {
    sentCodes.push(otp); sentEmails.push({ email, purpose, code: otp });
  });
  app.post("/api/customers/login", (_req, res) => res.json({ success: true, customer: db.customer }));
  app.post("/api/customers/signup", (_req, res) => res.json({ success: true, customer: db.customer }));
  // Existing duplicate runtime handlers query historical guest orders by email.
  app.get("/api/orders/customer/:email", (_req, res) => res.json([{ id: "historical-guest-order", customerEmail: db.customer.email, shippingAddress: "private historical address" }]));
  app.all("/{*path}", (req, res) => res.json({ reached: true, body: req.body }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "";
  const request = async (path: string, method = "GET", body?: any, override?: Record<string, string>) => {
    const response = await fetch(`${origin}${path}`, { method, headers: {
      Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...override,
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return response;
  };
  const login = async () => {
    const response = await request("/api/admin/login", "POST", { email: db.admin.email, password: "correct-password" });
    cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
    return response;
  };
  return { db, request, login, sentCodes, sentEmails, getCookie: () => cookie, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}

test("permission map protects management, uploads, customer-data and preserves public reads", () => {
  assert.equal(adminPermissionForRoute("/api/admins", "GET"), "super");
  assert.equal(adminPermissionForRoute("/api/products/p/stock", "PATCH"), "canManageStock");
  assert.equal(adminPermissionForRoute("/api/products/p", "PATCH"), "canManageProducts");
  assert.equal(adminPermissionForRoute("/api/orders", "GET"), "canManageOrders");
  assert.equal(adminPermissionForRoute("/api/admin/redotpay", "GET"), "canManageOrders");
  assert.equal(adminPermissionForRoute("/api/admin/quotations", "GET"), "canManageOrders");
  assert.equal(adminPermissionForRoute("/api/admin/quotations/id", "PATCH"), "canManageOrders");
  assert.equal(adminPermissionForRoute("/api/admin/purchase-orders", "GET"), "canManageStock");
  assert.equal(adminPermissionForRoute("/api/admin/purchase-orders/id", "PATCH"), "canManageStock");
  assert.equal(adminPermissionForRoute("/api/uploads/product-images", "POST"), "canManageProducts");
  assert.equal(adminPermissionForRoute("/api/products", "GET"), null);
  assert.equal(adminPermissionForRoute("/api/orders/track/number", "GET"), null);
  assert.equal(adminPermissionForRoute("/api/coupons/validate", "POST"), null);
  assert.equal(hasAdminPermission({ isSuperAdmin: false, permissions }, "canManageProducts"), false);
  assert.equal(hasAdminPermission({ isSuperAdmin: true, permissions }, "canManageProducts"), true);
  assert.equal(hasAdminPermission({ isSuperAdmin: false, permissions: null }, "canManageProducts"), false);
});

for (const arrayShape of [false, true]) {
  test(`HTTP integration: session, expiry, live permissions, forgery, CSRF, logout (${arrayShape ? "postgres-js" : "pg"})`, async () => {
    const h = await harness(arrayShape);
    try {
      assert.equal((await h.request("/api/orders")).status, 401);
      assert.equal((await h.request("/API/ORDERS")).status, 404);
      assert.equal((await h.request("/api/orders", "GET", undefined, { Authorization: "Bearer forged", Cookie: "admin-auth-storage=super" })).status, 401);
      const login = await h.login();
      assert.equal(login.status, 200);
      assert.match(login.headers.get("set-cookie")!, /HttpOnly/);
      assert.match(login.headers.get("set-cookie")!, /SameSite=Lax/);
      assert.match(login.headers.get("set-cookie")!, /Max-Age=28800/);
      assert.equal((await h.request("/api/orders")).status, 200);
      assert.equal((await h.request("/api/admin/redotpay")).status, 200);
      assert.equal((await h.request("/api/admins", "POST", { isSuperAdmin: true })).status, 403);
      assert.equal((await h.request("/api/products/p", "PATCH", {})).status, 403);
      assert.equal((await h.request("/api/orders/o/status", "PATCH", {}, { Origin: "https://evil.test" })).status, 403);
      assert.equal((await h.request("/api/orders/o/status", "PATCH", {}, { Origin: "" })).status, 403);
      assert.equal((await h.request("/api/orders/o/status", "PATCH", {})).status, 200);
      h.db.admin.permissions = { ...permissions, canManageOrders: false };
      assert.equal((await h.request("/api/orders")).status, 403);
      h.db.admin.permissions = permissions;
      const session = [...h.db.sessions.values()][0];
      session.expired = true;
      assert.equal((await h.request("/api/admin/session")).status, 401);
      session.expired = false;
      const oldPassword = h.db.admin.password;
      h.db.admin.password = "changed";
      assert.equal((await h.request("/api/admin/session")).status, 401);
      h.db.admin.password = oldPassword;
      assert.equal((await h.request("/api/admin/logout", "POST")).status, 200);
      assert.equal(h.db.sessions.size, 0);
      assert.equal((await h.request("/api/orders")).status, 401);
    } finally { await h.close(); }
  });
}

test("shared DB budgets, cryptographic OTP hashing and atomic one-use reset revoke sessions", async () => {
  const h = await harness();
  try {
    await h.login();
    assert.equal((await h.request("/api/admin/forgot-password", "POST", { email: h.db.admin.email })).status, 200);
    assert.match(h.sentCodes[0], /^\d{6}$/);
    const reset = { email: h.db.admin.email, otp: h.sentCodes[0], newPassword: "a-new-password" };
    assert.equal((await h.request("/api/admin/reset-password", "POST", reset)).status, 200);
    assert.equal((await h.request("/api/admin/reset-password", "POST", reset)).status, 400);
    assert.equal((await h.request("/api/admin/session")).status, 401);
    for (let i = 0; i < 9; i++) await h.request("/api/admin/login", "POST", { email: h.db.admin.email, password: "wrong" });
    assert.equal((await h.request("/api/admin/login", "POST", { email: h.db.admin.email, password: "a-new-password" })).status, 429);
    assert.ok(h.db.queries.some(q => q.includes("ON CONFLICT (key) DO UPDATE")));
  } finally { await h.close(); }
});

test("public COD/bank creation strips server-owned state; provider bypass and admin/customer reads denied", async () => {
  const h = await harness();
  try {
    const response = await h.request("/api/orders", "POST", { paymentMethod: "bank", status: "paid", invoiceNumber: "forged", adminNote: "forged", deliveryStatus: "delivered" });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.body.status, "pending");
    assert.equal(result.body.invoiceNumber, undefined);
    assert.equal(result.body.adminNote, undefined);
    assert.equal(result.body.deliveryStatus, undefined);
    assert.equal((await h.request("/api/orders", "POST", { paymentMethod: "redotpay" })).status, 400);
    assert.equal((await h.request("/api/orders/track/123")).status, 200);
    assert.equal((await h.request("/api/customers/customer-id")).status, 401);
    assert.equal((await h.request("/api/orders/customer/victim@example.test")).status, 401);
    assert.equal((await h.request("/api/email/test", "POST", {})).status, 401);
    assert.equal((await h.request("/api/uploads/product-images", "POST", {})).status, 401);
  } finally { await h.close(); }
});

test("policy adapter never authenticates a second cookie or queries sessions", async () => {
  let calls = 0;
  const db = { execute: async () => { calls++; throw new Error("offline"); } };
  assert.equal(await getAuthenticatedAdmin({ headers: { cookie: "veltrix_admin_session=forged" } } as any, db), null);
  assert.equal(calls, 0);
  assert.equal(await getAuthenticatedAdmin({ headers: { cookie: `veltrix_admin_session=${"a".repeat(64)}` } } as any, db), null);
  const admin = { id: "authenticated-by-shared-session" };
  assert.equal(await getAuthenticatedAdmin({ res: { locals: { admin } } } as any, db), admin);
  assert.equal(calls, 0);
});

test("customer login issues session, ownership is enforced, logout revokes and profile cannot reassign identity", async () => {
  const h = await harness();
  try {
    const login = await h.request("/api/customers/login", "POST", {});
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const headers = { Cookie: cookie };
    assert.equal((await h.request("/api/customers/customer-1", "GET", undefined, headers)).status, 200);
    assert.equal((await h.request("/api/customers/victim", "GET", undefined, headers)).status, 403);
    assert.equal((await h.request("/api/orders/customer/customer@example.test", "GET", undefined, headers)).status, 403);
    assert.equal((await h.request("/api/orders/customer/victim@example.test", "GET", undefined, headers)).status, 403);
    assert.equal((await h.request("/api/addresses/address-1", "PATCH", {}, headers)).status, 200);
    assert.equal((await h.request("/api/addresses/address-victim", "DELETE", undefined, headers)).status, 403);
    assert.equal((await h.request("/api/customers/victim/addresses/address-1/default", "POST", {}, headers)).status, 403);
    const profile = await h.request("/api/customers/customer-1", "PATCH", { name: "Updated", email: "victim@example.test", password: "forged", id: "victim" }, headers);
    assert.deepEqual((await profile.json()).body, { name: "Updated" });
    assert.equal((await h.request("/api/customers/customer-1", "PATCH", {}, { ...headers, Origin: "https://evil.test" })).status, 403);
    assert.equal((await h.request("/api/customers/logout", "POST", {}, headers)).status, 200);
    assert.equal((await h.request("/api/customers/customer-1", "GET", undefined, headers)).status, 401);
  } finally { await h.close(); }
});

for (const arrayShape of [false, true]) {
  test(`unused guest email signup cannot steal history; inbox proof unlocks rightful historical orders (${arrayShape ? "postgres-js" : "pg"})`, async () => {
    const h = await harness(arrayShape);
    try {
      const signup = await h.request("/api/customers/signup", "POST", { email: h.db.customer.email, password: "attacker-chosen", emailVerified: true });
      const cookie = signup.headers.get("set-cookie")!.split(";")[0];
      const headers = { Cookie: cookie };
      const history = "/api/orders/customer/customer@example.test";
      const denied = await h.request(history, "GET", undefined, headers);
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).code, "EMAIL_VERIFICATION_REQUIRED");
      assert.equal((await h.request(history, "GET", undefined, { ...headers, "X-Email-Verified": "true" })).status, 403);
      assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: "123456", verified: true }, headers)).status, 400);
      assert.equal((await h.request("/api/customers/verify-email/request", "POST", { email: "attacker@example.test" }, { ...headers, Origin: "https://evil.test" })).status, 403);
      assert.equal((await h.request("/api/customers/verify-email/request", "POST", { email: "attacker@example.test" }, headers)).status, 200);
      const sent = h.sentEmails.at(-1)!;
      assert.equal(sent.email, h.db.customer.email);
      assert.equal(sent.purpose, "customer-verification");
      assert.match(sent.code, /^\d{6}$/);
      const proof = h.db.emailProofs.get(h.db.customer.id)!;
      assert.equal(proof.codeHash, hash(sent.code));
      assert.notEqual(proof.codeHash, sent.code);
      assert.equal((await h.request(history, "GET", undefined, headers)).status, 403);
      proof.expired = true;
      assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: sent.code }, headers)).status, 400);
      proof.expired = false;
      // A customer who can read their inbox supplies the actual one-time code.
      assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: sent.code }, headers)).status, 200);
      const approved = await h.request(history, "GET", undefined, headers);
      assert.equal(approved.status, 200);
      assert.equal((await approved.json())[0].id, "historical-guest-order");
      assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: sent.code }, headers)).status, 400);
      const subsequentLogin = await h.request("/api/customers/login", "POST", {});
      const subsequentHeaders = { Cookie: subsequentLogin.headers.get("set-cookie")!.split(";")[0] };
      assert.equal((await h.request(history, "GET", undefined, subsequentHeaders)).status, 200);
      assert.equal((await h.request("/api/orders/customer/another@example.test", "GET", undefined, headers)).status, 403);
      // Verification is bound to both account ID and current mailbox.
      h.db.customer.email = "changed@example.test";
      assert.equal((await h.request("/api/orders/customer/changed@example.test", "GET", undefined, headers)).status, 403);
    } finally { await h.close(); }
  });
}

test("customer email proof has shared brute-force limits and requires a customer session", async () => {
  const h = await harness();
  try {
    assert.equal((await h.request("/api/customers/verify-email/request", "POST", {})).status, 401);
    const login = await h.request("/api/customers/login", "POST", {});
    const headers = { Cookie: login.headers.get("set-cookie")!.split(";")[0] };
    for (let i = 0; i < 3; i++)
      assert.equal((await h.request("/api/customers/verify-email/request", "POST", {}, headers)).status, 200);
    assert.equal((await h.request("/api/customers/verify-email/request", "POST", {}, headers)).status, 429);
    for (let i = 0; i < 10; i++)
      assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: "000000" }, headers)).status, 400);
    assert.equal((await h.request("/api/customers/verify-email/confirm", "POST", { code: h.sentCodes.at(-1) }, headers)).status, 429);
  } finally { await h.close(); }
});

test("auth and inventory migrations enable server-only RLS and conditional browser-role revocation", () => {
  for (const [file, tables] of [
    ["admin-security-migration.sql", ["admin_sessions", "customer_sessions", "admin_auth_limits", "customer_email_proofs"]],
    ["inventory-safety-migration.sql", ["legacy_inventory_reservations"]],
  ] as const) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const table of tables) assert.match(text, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(text, /REVOKE ALL ON .+ FROM PUBLIC/);
    assert.match(text, /ARRAY\['anon', 'authenticated'\]/);
    assert.match(text, /IF EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = browser_role\)/);
    assert.match(text, /REVOKE ALL ON .+ FROM %I/);
    assert.doesNotMatch(text, /CREATE POLICY|ALTER TABLE \w+ FORCE ROW LEVEL SECURITY/);
  }
});