import type { Express, Request } from "express";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { DEFAULT_ADMIN_PERMISSIONS, LEGACY_PERMISSION_PARENTS, effectiveAdminPermission, resolvedAdminPermissions, type AdminPermissions } from "./admin-permissions.js";

const derive = promisify(scrypt);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const rows = (result: any): any[] => result.rows ?? result;
const cookieName = process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";
const lifetime = 8 * 60 * 60 * 1000;

// Compatible with the existing scrypt hash.salt format; malformed records fail closed.
export async function verifyAdminPassword(password: unknown, stored: unknown): Promise<boolean> {
  if (typeof password !== "string" || password.length > 1024 || typeof stored !== "string") return false;
  const match = /^([a-f0-9]{128})\.([a-f0-9]{32})$/i.exec(stored);
  if (!match) return false;
  const actual = await derive(password, match[2], 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(match[1], "hex"));
}

export function hasAdminPermission(admin: any, permission: string): boolean {
  return effectiveAdminPermission(admin, permission);
}

/** The Add Admin flow creates regular accounts; the two designated super-admins are not assigned here. */
export function regularAdminCreation<T extends { isSuperAdmin?: boolean | null; permissions?: Partial<AdminPermissions> | null }>(
  candidate: T,
): Omit<T, "permissions" | "isSuperAdmin"> & { isSuperAdmin: false; permissions: AdminPermissions } {
  if (candidate.isSuperAdmin === true) throw new Error("Super-admin accounts cannot be created from Add Admin.");
  const requested = candidate.permissions ?? {};
  const base = { ...DEFAULT_ADMIN_PERMISSIONS, ...requested };
  for (const [key, parent] of Object.entries(LEGACY_PERMISSION_PARENTS)) {
    if (requested[key as keyof AdminPermissions] === undefined) {
      base[key as keyof AdminPermissions] = base[parent as keyof AdminPermissions];
    }
  }
  return { ...candidate, isSuperAdmin: false, permissions: resolvedAdminPermissions(base) };
}

export function isAdminSameOrigin(req: Pick<Request, "headers" | "get">): boolean {
  const configured = process.env.ADMIN_PUBLIC_ORIGIN || process.env.REDOTPAY_PUBLIC_ORIGIN;
  try {
    // Development previews may terminate HTTPS at the preview proxy. Host is
    // used only in development, never to infer a trusted production origin.
    const origin = configured || (process.env.NODE_ENV !== "production" && typeof req.headers.origin === "string" ? req.headers.origin : "");
    const allowed = [origin, ...(process.env.ADMIN_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)];
    for (const value of allowed) {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value ||
          (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) return false;
    }
    if (!configured && new URL(origin).host !== req.get("host")) return false;
    return typeof req.headers.origin === "string" &&
      allowed.includes(req.headers.origin) &&
      req.headers["sec-fetch-site"] !== "cross-site";
  } catch { return false; }
}

export function adminPermissionFor(method: string, path: string): string | null {
  path = path.toLowerCase().replace(/\/+$/, "");
  if (/^\/api\/admins(?:\/|$)/.test(path)) return "super";
  if (/^\/api\/email(?:\/|$)/.test(path)) return "super";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (/^\/api\/admin\/quotations(?:\/|$)/.test(path)) return "canManageQuotations";
  if (/^\/api\/admin\/purchase-orders(?:\/|$)/.test(path)) return "canManagePurchaseOrders";
  if (/^\/api\/products\/[^/]+\/stock\/?$/.test(path)) return "canManageStock";
  if (/^\/api\/(products|categories)(?:\/|$)/.test(path)) return "canManageProducts";
  if (/^\/api\/coupons(?:\/|$)/.test(path) && !/^\/api\/coupons\/validate(?:\/|$)/.test(path)) return "canManageCoupons";
  if (/^\/api\/orders\/[^/]+(?:\/|$)/.test(path)) return "canManageOrders";
  if (/^\/api\/pos(?:\/|$)/.test(path)) return "canAccessPOS";
  return null;
}

export function registerAdminAuth(app: Express, getDb: () => any) {
  // Lax preserves the secure host-only session across normal top-level
  // navigation while mutation routes remain protected by explicit origin checks.
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  function token(req: Request) {
    const value = req.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  async function revoke(req: Request) {
    const value = token(req);
    if (value) await getDb().execute(sql`DELETE FROM admin_sessions WHERE token_hash = ${digest(value)}`);
  }
  async function throttle(key: string, limit: number) {
    const result = rows(await getDb().execute(sql`
      INSERT INTO admin_auth_throttle (bucket, attempts, expires_at)
      VALUES (${digest(key)}, 1, now() + interval '15 minutes')
      ON CONFLICT (bucket) DO UPDATE SET
        attempts = CASE WHEN admin_auth_throttle.expires_at <= now() THEN 1 ELSE admin_auth_throttle.attempts + 1 END,
        expires_at = CASE WHEN admin_auth_throttle.expires_at <= now() THEN now() + interval '15 minutes' ELSE admin_auth_throttle.expires_at END
      RETURNING attempts`));
    return result[0].attempts <= limit;
  }
  const profile = (admin: any) => ({ id: admin.id, name: admin.name, email: admin.email, isSuperAdmin: admin.isSuperAdmin, permissions: admin.permissions });

  app.use(async (req, res, next) => {
    // Express routes are case-insensitive and accept trailing slashes by default.
    const path = req.path.toLowerCase().replace(/\/+$/, "");
    const permission = adminPermissionFor(req.method, path);
    const authPath = /^\/api\/admin(?:\/|$)/.test(path);
    // Payment routes also consume res.locals.admin, but anonymous checkout stays available.
    const paymentPath = /^\/api\/(?:redotpay|payments)(?:\/|$)/.test(path);
    // The policy/customer/inventory adapters also consume this single session.
    if (!req.path.toLowerCase().startsWith("/api/")) return next();
    try {
      if ((permission || authPath) && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !isAdminSameOrigin(req)) {
        return res.status(403).json({ message: "Same-origin admin request required" });
      }
      if (permission || authPath) res.setHeader("Cache-Control", "no-store");
      const value = token(req);
      if (value) {
        const admin = rows(await getDb().execute(sql`
          SELECT a.id, a.name, a.email, a.password, a.is_super_admin AS "isSuperAdmin", a.permissions, s.password_fingerprint
          FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
          WHERE s.token_hash = ${digest(value)} AND s.expires_at > now()`))[0];
        if (admin && admin.password_fingerprint === digest(admin.password)) res.locals.admin = profile(admin);
      }
      if (permission && !res.locals.admin) return res.status(401).json({ message: "Admin session required" });
      if (permission && !hasAdminPermission(res.locals.admin, permission)) return res.status(403).json({ message: "Admin permission required" });
      if (authPath && req.method === "POST" && ["/api/admin/login", "/api/admin/forgot-password", "/api/admin/reset-password"].includes(path)) {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (email.length > 320 || !email) return res.status(400).json({ message: "Valid email required" });
        // req.ip is deliberately not derived from an untrusted forwarded header.
        const allowedIp = await throttle(`ip:${req.ip}`, 60);
        const allowedEmail = await throttle(`account:${email}`, 10);
        if (!allowedIp || !allowedEmail) {
          res.setHeader("Retry-After", "900");
          return res.status(429).json({ message: "Too many authentication attempts. Try again in 15 minutes." });
        }
      }
      next();
    } catch {
      return res.status(503).json({ message: "Admin authentication unavailable" });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const email = req.body.email.trim();
      const admin = rows(await getDb().execute(sql`SELECT id, name, email, password, is_super_admin AS "isSuperAdmin", permissions FROM admins WHERE lower(email) = lower(${email}) LIMIT 1`))[0];
      // Equal-cost password derivation for unknown users.
      const stored = admin?.password ?? `${"00".repeat(64)}.${"00".repeat(16)}`;
      const valid = await verifyAdminPassword(req.body.password, stored);
      if (!admin || !valid) return res.status(401).json({ success: false, message: "Invalid credentials" });
      await revoke(req);
      const value = randomBytes(32).toString("hex");
      await getDb().execute(sql`INSERT INTO admin_sessions (token_hash, admin_id, password_fingerprint, expires_at) VALUES (${digest(value)}, ${admin.id}, ${digest(admin.password)}, ${new Date(Date.now() + lifetime).toISOString()})`);
      res.cookie(cookieName, value, { ...options, maxAge: lifetime });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ success: true, admin: profile(admin) });
    } catch { return res.status(503).json({ success: false, message: "Admin authentication unavailable" }); }
  });
  app.get("/api/admin/session", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!res.locals.admin) return res.status(401).json({ success: false, message: "Admin session required" });
    return res.json({ success: true, admin: res.locals.admin });
  });
  app.post("/api/admin/logout", async (req, res) => {
    try {
      await revoke(req);
      res.clearCookie(cookieName, options);
      return res.json({ success: true });
    } catch { return res.status(503).json({ message: "Session revocation unavailable; please retry logout" }); }
  });
}