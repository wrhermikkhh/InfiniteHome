import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHash, scryptSync } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { registerAdminAuth, verifyAdminPassword, adminPermissionFor, hasAdminPermission } from "../shared/admin-auth";

const salt = "12".repeat(16);
const password = `${scryptSync("test-only-password", salt, 64).toString("hex")}.${salt}`;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");

test("password format compatibility and malformed hashes", async () => {
  assert.equal(await verifyAdminPassword("test-only-password", password), true);
  assert.equal(await verifyAdminPassword("wrong", password), false);
  for (const value of ["plaintext", "bad.salt", null, "00.00"]) assert.equal(await verifyAdminPassword("password", value), false);
  assert.equal(await verifyAdminPassword({ password: "x" }, password), false);
});

test("permission mapping denies implicit defaults and forged truthy flags", () => {
  assert.equal(hasAdminPermission({ permissions: {} }, "canManageOrders"), false);
  assert.equal(hasAdminPermission({ isSuperAdmin: "true" }, "canManageOrders"), false);
  assert.equal(adminPermissionFor("PATCH", "/api/products/1"), "canManageProducts");
  assert.equal(adminPermissionFor("PATCH", "/api/products/1/stock"), "canManageStock");
  assert.equal(adminPermissionFor("POST", "/api/coupons/validate"), null);
  assert.equal(adminPermissionFor("DELETE", "/api/coupons/1"), "canManageCoupons");
  assert.equal(adminPermissionFor("POST", "/api/admins"), "super");
});

test("both adapters install shared sessions before payment and admin routes; no profile-only login remains", () => {
  assert.match(readFileSync("api/index.ts", "utf8"), /registerRoutes\(createServer\(app\), app\)/);
  for (const path of ["server/routes.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.indexOf("registerAdminAuth(app") < source.indexOf("registerRedotPay(app"));
    assert.ok(source.indexOf("registerAdminAuth(app") < source.indexOf('app.post("/api/admins"'));
    assert.equal(source.includes('app.post("/api/admin/login"'), false);
  }
  const frontend = readFileSync("client/src/lib/auth.ts", "utf8");
  assert.equal(frontend.includes('name: "admin-auth-storage"'), false);
  assert.ok(frontend.includes('fetch("/api/admin/session"'));
});

test("isolated sessions: origin, login, authorization, live revocation, throttling, logout", async () => {
  const previous = process.env.ADMIN_PUBLIC_ORIGIN;
  const previousAllowed = process.env.ADMIN_ALLOWED_ORIGINS;
  process.env.ADMIN_PUBLIC_ORIGIN = "https://admin.example.test";
  process.env.ADMIN_ALLOWED_ORIGINS = "https://store.example.test";
  const sessions = new Map<string, any>();
  const attempts = new Map<string, number>();
  const admin = { id: "operator", name: "Operator", email: "test@example.test", password, isSuperAdmin: false, permissions: { canManageProducts: true, canManageOrders: true } };
  let exists = true;
  let unavailable = false;
  const db = { execute: async (query: any) => {
    if (unavailable) throw new Error("Isolated DB unavailable");
    const { sql, params } = new PgDialect().sqlToQuery(query);
    if (sql.includes("INSERT INTO admin_auth_throttle")) {
      const count = (attempts.get(params[0] as string) || 0) + 1;
      attempts.set(params[0] as string, count);
      return [{ attempts: count }];
    }
    if (sql.includes("DELETE FROM admin_sessions")) { sessions.delete(params[0] as string); return []; }
    if (sql.includes("INSERT INTO admin_sessions")) {
      sessions.set(params[0] as string, { password_fingerprint: params[2], expires_at: params[3] }); return [];
    }
    if (sql.includes("FROM admin_sessions")) {
      const session = sessions.get(params[0] as string);
      return session && exists && Date.parse(session.expires_at) > Date.now() ? [{ ...admin, ...session }] : [];
    }
    if (sql.includes("FROM admins WHERE")) return exists && params[0] === admin.email ? [admin] : [];
    throw new Error("Unexpected isolated database query");
  }};
  const app = express();
  app.use(express.json());
  registerAdminAuth(app, () => db);
  app.patch("/api/products/:id", (_req, res) => res.json({ ok: true }));
  app.patch("/api/orders/:id/status", (_req, res) => res.json({ ok: true }));
  app.post("/api/admins", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const port = (server.address() as any).port;
  const request = (path: string, method = "GET", cookie = "", body?: any, origin = "https://admin.example.test") =>
    fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { origin, cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request("/api/products/1", "PATCH")).status, 401);
    assert.equal((await request("/API/PRODUCTS/1/", "PATCH")).status, 401);
    assert.equal((await request("/api/admins", "POST", "", { isSuperAdmin: true })).status, 401);
    assert.equal((await request("/api/admin/login", "POST", "", { email: admin.email, password: "test-only-password" }, "https://evil.example")).status, 403);
    assert.equal((await request("/api/admin/login", "POST", "", { email: admin.email, password: "test-only-password" }, "https://store.example.test")).status, 200);
    const login = await request("/api/admin/login", "POST", "", { email: admin.email, password: "test-only-password" });
    assert.equal(login.status, 200);
    const header = login.headers.get("set-cookie")!;
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Strict/);
    const cookie = header.split(";")[0];
    assert.equal((await request("/api/admin/session", "GET", cookie)).status, 200);
    assert.equal((await request("/api/admin/session", "GET", `admin_session=${"00".repeat(32)}`)).status, 401);
    assert.equal((await request("/api/products/1", "PATCH", cookie)).status, 200);
    assert.equal((await request("/api/admins", "POST", cookie)).status, 403);
    unavailable = true;
    assert.equal((await request("/api/products/1", "PATCH", cookie)).status, 503);
    unavailable = false;
    assert.equal((await request("/api/products/1", "PATCH", cookie, {}, "https://evil.example")).status, 403);
    admin.permissions.canManageProducts = false;
    assert.equal((await request("/api/products/1", "PATCH", cookie)).status, 403);
    admin.password = "changed";
    assert.equal((await request("/api/admin/session", "GET", cookie)).status, 401);
    admin.password = password;
    exists = false;
    assert.equal((await request("/api/admin/session", "GET", cookie)).status, 401);
    exists = true;
    const record = sessions.get(digest(cookie.split("=")[1]))!;
    record.expires_at = new Date(0).toISOString();
    assert.equal((await request("/api/admin/session", "GET", cookie)).status, 401);
    record.expires_at = new Date(Date.now() + 10000).toISOString();
    assert.equal((await request("/api/admin/logout", "POST", cookie)).status, 200);
    assert.equal((await request("/api/admin/session", "GET", cookie)).status, 401);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await request("/api/admin/login", "POST", "", { email: admin.email, password: "wrong" })).status;
    assert.equal(last, 429);
    assert.equal((await request("/API/ADMIN/LOGIN/", "POST", "", { email: admin.email, password: "wrong" })).status, 429);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previous === undefined) delete process.env.ADMIN_PUBLIC_ORIGIN;
    else process.env.ADMIN_PUBLIC_ORIGIN = previous;
    if (previousAllowed === undefined) delete process.env.ADMIN_ALLOWED_ORIGINS;
    else process.env.ADMIN_ALLOWED_ORIGINS = previousAllowed;
  }
});