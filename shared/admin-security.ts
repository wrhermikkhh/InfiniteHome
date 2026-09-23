import { createHash, randomBytes, randomInt, scryptSync } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import type { Admin } from "./schema.js";
import { transportPeerBucket } from "./request-identity.js";
import { hasAdminPermission as sessionPermission, isAdminSameOrigin } from "./admin-auth.js";

type Database = { execute: (query: any) => Promise<any> };
type Permission = "canManageProducts" | "canManageStock" | "canManageOrders" | "canManageCoupons" | "canAccessPOS";
export const securityRows = (result: any): any[] => Array.isArray(result) ? result : result?.rows || [];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const customerCookie = "veltrix_customer_session";
const lifetime = 8 * 60 * 60;
function token(req: Request, name = customerCookie) {
  return (req.headers.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}
function secureCookie(req: Request) {
  return process.env.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https";
}
function setSessionCookie(req: Request, res: Response, name: string, value: string, maxAge = lifetime) {
  res.append("Set-Cookie", `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie(req) ? "; Secure" : ""}`);
}
export function hasAdminPermission(admin: Pick<Admin, "isSuperAdmin" | "permissions"> | null, permission: Permission): boolean {
  return sessionPermission(admin, permission);
}
/** Validates opaque cookie against an unexpired database session and current password.
 * Supports node-postgres {rows} and postgres-js array execute results. No client role trust.
 */
export async function getAuthenticatedAdmin(req: Request, db: Database): Promise<Admin | null> {
  // registerAdminAuth must precede this policy adapter. Never parse a second cookie.
  return req.res?.locals.admin || null;
}
/** Origin enforcement intentionally rejects missing Origin on browser/admin mutations. */
export function isSameOrigin(req: Request): boolean {
  return isAdminSameOrigin(req);
}
async function rateLimit(db: Database, key: string, limit: number): Promise<boolean> {
  const rows = securityRows(await db.execute(sql`
    INSERT INTO admin_auth_limits (key, attempts, window_start) VALUES (${digest(key)}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN admin_auth_limits.window_start < now() - interval '15 minutes' THEN 1 ELSE admin_auth_limits.attempts + 1 END,
      window_start = CASE WHEN admin_auth_limits.window_start < now() - interval '15 minutes' THEN now() ELSE admin_auth_limits.window_start END
    RETURNING attempts`));
  return rows[0]?.attempts <= limit;
}
function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${scryptSync(password, salt, 64).toString("hex")}.${salt}`;
}
async function issueSession(db: Database, req: Request, res: Response, id: string, customer = true) {
  const value = randomBytes(32).toString("hex");
  await db.execute(sql`INSERT INTO customer_sessions (token_hash, customer_id, password_fingerprint, expires_at)
      SELECT ${digest(value)}, id, md5(password), now() + interval '8 hours' FROM customers WHERE id = ${id}`);
  setSessionCookie(req, res, customerCookie, value);
}
async function authenticatedCustomer(req: Request, db: Database) {
  const value = token(req, customerCookie);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return securityRows(await db.execute(sql`SELECT c.id, c.email FROM customer_sessions s
    JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ${digest(value)}
    AND s.expires_at > now() AND s.password_fingerprint = md5(c.password) LIMIT 1`))[0] || null;
}
export function adminPermissionForRoute(path: string, method: string): Permission | "super" | null {
  const write = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (/^\/api\/admins(?:\/|$)/.test(path)) return "super";
  if (/^\/api\/(email|settings|storage\/health|uploads\/debug)(?:\/|$)/.test(path)) return "super";
  if (path.startsWith("/api/admin/redotpay")) return "canManageOrders";
  if (/^\/api\/admin\/manual-orders(?:\/|$)/.test(path)) return "canManageOrders";
  if (path.startsWith("/api/admin/inventory/")) return "canManageStock";
  if (/^\/api\/admin\/product-details(?:\/|$)/.test(path)) return "canManageProducts";
  if (/^\/api\/admin\/quotations(?:\/|$)/.test(path)) return "canManageOrders";
  if (/^\/api\/admin\/purchase-orders(?:\/|$)/.test(path)) return "canManageStock";
  if (path.startsWith("/api/admin/")) return "super";
  if (/^\/api\/(products|categories)(?:\/|$)/.test(path) && write)
    return /\/stock(?:\/|$)/.test(path) ? "canManageStock" : "canManageProducts";
  if (path === "/api/uploads/product-images" || path === "/api/uploads/request-url") return "canManageProducts";
  if (path.startsWith("/api/coupons") && !path.startsWith("/api/coupons/validate")) return "canManageCoupons";
  if (path.startsWith("/api/pos/") && !path.startsWith("/api/pos/track/")) return "canAccessPOS";
  if (path.startsWith("/api/payment-slips/")) return "canManageOrders";
  if (path === "/api/orders") return write && method === "POST" ? null : "canManageOrders";
  if (path.startsWith("/api/orders/") && !path.startsWith("/api/orders/track/") && !path.startsWith("/api/orders/customer/")) return "canManageOrders";
  return null;
}
const inventoryFields = ["stock", "variantStock", "preOrderStock", "preOrderVariantStock"] as const;
function canonical(value: any): string {
  if (value && typeof value === "object" && !Array.isArray(value))
    return JSON.stringify(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return JSON.stringify(value);
}

/** Install BEFORE every API router (including uploads and payment operators). */
export function registerAdminSecurity(app: Express, getDb: () => Database, sendReset: (email: string, name: string, otp: string, purpose?: "customer-verification") => Promise<any>) {
  app.use(async (req, res, next) => {
    if (!/^\/api\//i.test(req.path)) return next();
    // Express matches route literals case-insensitively; reject noncanonical paths.
    if (/[A-Z]/.test(req.path.split("/").slice(0, 3).join("/")))
      return res.status(404).json({ message: "Use canonical API route casing" });
    try {
      const db = getDb();
      const path = req.path.replace(/\/+$/, "");
      const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      const authAction = /^\/api\/admin\/(forgot-password|reset-password)$/.test(path);
      if (authAction) {
        if (req.method !== "POST") return res.status(405).json({ message: "POST required" });
        if (!isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email || email.length > 254) return res.status(400).json({ message: "Valid email required" });
        // A transport peer can represent the entire hosting proxy, not a person.
        // Use only a broad infrastructure budget; the account budget is authoritative.
        const ipOk = await rateLimit(db, `transport-peer:${transportPeerBucket(req)}`, 600);
        const accountOk = await rateLimit(db, `${path}:${email}`, path.endsWith("forgot-password") ? 3 : 10);
        if (!ipOk || !accountOk) return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
        const admin = securityRows(await db.execute(sql`SELECT id, name, email, password,
          is_super_admin AS "isSuperAdmin", permissions FROM admins WHERE lower(email) = ${email} LIMIT 1`))[0] as Admin | undefined;
        if (path.endsWith("/forgot-password")) {
          if (admin) {
            const otp = randomInt(100000, 1000000).toString();
            await db.execute(sql`UPDATE admins SET reset_token = ${digest(otp)}, reset_token_expiry = now() + interval '15 minutes' WHERE id = ${admin.id}`);
            await sendReset(admin.email, admin.name, otp);
          }
          return res.json({ success: true });
        }
        const { otp, newPassword } = req.body;
        if (typeof otp !== "string" || !/^\d{6}$/.test(otp) || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 1024)
          return res.status(400).json({ message: "Valid OTP and password of 8–1024 characters required" });
        // Atomic consumption prevents replay; password fingerprint revokes all previous sessions.
        const updated = securityRows(await db.execute(sql`UPDATE admins SET password = ${passwordHash(newPassword)},
          reset_token = NULL, reset_token_expiry = NULL WHERE lower(email) = ${email}
          AND reset_token = ${digest(otp)} AND reset_token_expiry > now() RETURNING id`));
        return updated.length ? res.json({ success: true }) : res.status(400).json({ message: "Invalid or expired OTP" });
      }
      // Customer sessions maintain existing customer flows without trusting localStorage IDs.
      if (["/api/customers/login", "/api/customers/signup"].includes(path) && req.method === "POST") {
        if (!isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
        const original = res.json.bind(res);
        res.json = ((body: any) => {
          if (!body?.success || !body.customer?.id) return original(body);
          void issueSession(db, req, res, body.customer.id, true).then(() => original(body)).catch(next);
          return res;
        }) as any;
        return next();
      }
      if (path === "/api/customers/logout" && req.method === "POST") {
        if (!isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
        await db.execute(sql`DELETE FROM customer_sessions WHERE token_hash = ${digest(token(req, customerCookie))}`);
        setSessionCookie(req, res, customerCookie, "", 0);
        return res.json({ success: true });
      }
      if (path.startsWith("/api/customers/verify-email/")) {
        res.setHeader("Cache-Control", "no-store");
        if (req.method !== "POST" || !["/api/customers/verify-email/request", "/api/customers/verify-email/confirm"].includes(path))
          return res.status(405).json({ message: "POST request or confirm required" });
        if (!isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
        const customer = await authenticatedCustomer(req, db);
        if (!customer) return res.status(401).json({ message: "Customer login required" });
        const email = customer.email.trim().toLowerCase();
        const sending = path.endsWith("/request");
        // Shared per-mailbox budgets survive signup, sessions, workers and resends.
        if (!await rateLimit(db, `customer-email:${sending ? "send" : "confirm"}:${email}`, sending ? 3 : 10))
          return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
        if (sending) {
          const code = randomInt(100000, 1000000).toString();
          await db.execute(sql`INSERT INTO customer_email_proofs (customer_id, email, code_hash, expires_at)
            VALUES (${customer.id}, ${email}, ${digest(code)}, now() + interval '15 minutes')
            ON CONFLICT (customer_id) DO UPDATE SET email = EXCLUDED.email,
              code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
              verified_at = CASE WHEN customer_email_proofs.email = EXCLUDED.email THEN customer_email_proofs.verified_at ELSE NULL END`);
          // The destination comes exclusively from the authenticated DB account.
          try {
            await sendReset(customer.email, "Customer", code, "customer-verification");
          } catch {
            return res.status(502).json({ message: "Unable to send the verification email. Please try again later." });
          }
          return res.json({ success: true, message: "A verification code was sent to your account email." });
        }
        const code = req.body?.code;
        if (typeof code !== "string" || !/^\d{6}$/.test(code))
          return res.status(400).json({ message: "Enter the six-digit verification code" });
        const verified = securityRows(await db.execute(sql`UPDATE customer_email_proofs
          SET verified_at = now(), code_hash = NULL, expires_at = NULL
          WHERE customer_id = ${customer.id} AND email = ${email}
            AND code_hash = ${digest(code)} AND expires_at > now() RETURNING customer_id`));
        return verified.length ? res.json({ success: true }) : res.status(400).json({ message: "Invalid or expired verification code" });
      }
      if (/^\/api\/(customers|addresses)(?:\/|$)/.test(path) || path.startsWith("/api/orders/customer/")) {
        const admin = await getAuthenticatedAdmin(req, db);
        if (admin && hasAdminPermission(admin, "canManageOrders")) {
          if (write && !isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
          return next();
        }
        const customer = await authenticatedCustomer(req, db);
        if (!customer) return res.status(401).json({ message: "Customer login required" });
        let owns = false;
        if (path.startsWith("/api/customers/")) owns = path.split("/")[3] === customer.id;
        if (path.startsWith("/api/orders/customer/")) owns = decodeURIComponent(path.slice("/api/orders/customer/".length)).toLowerCase() === customer.email.toLowerCase();
        const addressId = path.startsWith("/api/addresses/") ? path.split("/")[3] : path.match(/\/addresses\/([^/]+)\/default$/)?.[1];
        if (addressId) owns = (path.startsWith("/api/addresses/") || owns) && !!securityRows(await db.execute(sql`SELECT id FROM customer_addresses WHERE id = ${addressId} AND customer_id = ${customer.id}`))[0];
        if (!owns || (write && !isSameOrigin(req))) return res.status(403).json({ message: "Customer ownership required" });
        if (path.startsWith("/api/orders/customer/")) {
          res.setHeader("Cache-Control", "no-store");
          const proof = securityRows(await db.execute(sql`SELECT customer_id FROM customer_email_proofs
            WHERE customer_id = ${customer.id} AND email = ${customer.email.trim().toLowerCase()}
              AND verified_at IS NOT NULL LIMIT 1`))[0];
          if (!proof) return res.status(403).json({
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Verify your account email before viewing orders associated with that address.",
          });
        }
        // Existing profile/address handlers spread body; reject ownership and credential spoofing.
        if (write && req.body) {
          delete req.body.id; delete req.body.customerId; delete req.body.password; delete req.body.email;
          if (path.includes("/addresses")) req.body.customerId = customer.id;
        }
        return next();
      }
      if (path === "/api/orders" && req.method === "POST") {
        if (!["cod", "bank"].includes(req.body?.paymentMethod)) return res.status(400).json({ message: "Use the dedicated checkout for this payment method" });
        const body = req.body;
        body.status = "pending";
        for (const key of ["id", "createdAt", "orderNumber", "trackingNumber", "statusHistory", "deliveryStatus", "deliveryStatusHistory", "adminNote", "invoiceNumber", "invoicedAt", "balanceInvoiceNumber", "balanceInvoicedAt", "paymentStatus", "paidAt", "paidAmount", "providerPaymentId", "inventoryStatus"]) delete body[key];
      }
      const permission = adminPermissionForRoute(path, req.method);
      if (permission) {
        const admin = await getAuthenticatedAdmin(req, db);
        if (!admin) return res.status(401).json({ message: "Admin login required" });
        if (permission === "super" ? !admin.isSuperAdmin : !hasAdminPermission(admin, permission))
          return res.status(403).json({ message: "Admin permission required" });
        if (write && !isSameOrigin(req)) return res.status(403).json({ message: "Same-origin request required" });
        if (req.method === "DELETE" && path === `/api/admins/${admin.id}`)
          return res.status(409).json({ message: "You cannot delete your own admin account" });
        if (write && path.startsWith("/api/admins") && req.body?.password !== undefined &&
            (typeof req.body.password !== "string" || req.body.password.length < 8 || req.body.password.length > 1024))
          return res.status(400).json({ message: "Password must contain 8–1024 characters" });
        // Product editing cannot bypass the separate Stock privilege by sending stock fields.
        if (write && /^\/api\/products(?:\/[^/]+)?$/.test(path) && !hasAdminPermission(admin, "canManageStock")) {
          let current: any = { stock: 0, variantStock: {}, preOrderStock: null, preOrderVariantStock: {} };
          if (req.method === "PATCH") {
            current = securityRows(await db.execute(sql`SELECT stock, variant_stock AS "variantStock",
              pre_order_stock AS "preOrderStock", pre_order_variant_stock AS "preOrderVariantStock"
              FROM products WHERE id = ${path.split("/")[3]}`))[0] || {};
          }
          if (inventoryFields.some(key => req.body?.[key] !== undefined && canonical(req.body[key]) !== canonical(current[key])))
            return res.status(403).json({ message: "Stock management permission required to change inventory" });
        }
        res.setHeader("Cache-Control", "no-store");
      }
      return next();
    } catch (error) {
      console.error("Security operation failed:", error instanceof Error ? error.name : "unknown");
      return res.status(503).json({ message: "Authentication service unavailable. Verify the security migration is installed." });
    }
  });
}