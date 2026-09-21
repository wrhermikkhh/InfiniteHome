import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";

const rows = (result: any): any[] => Array.isArray(result) ? result : result.rows || [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const BROWSER_ID_COOKIE = "veltrix_browser_id";
const cookieToken = (req: Request, name: string) =>
  (req.headers?.cookie || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";

/** Transport peer ONLY, not a proven customer IP. Behind a proxy this is shared:
 * use only for broad infrastructure budgets, never individual ownership/caps.
 * No runtime-specific forwarded header has verified provenance in this project.
 */
export function transportPeerBucket(req: Request): string {
  return hash(req.socket?.remoteAddress || "shared-unknown-peer");
}

/** Server-issued, database-validated opaque browser identity. Client-selected
 * cookie values and forwarded headers cannot select an existing identity.
 * Global budgets/caps must still apply: cookie deletion is not proof of a new human.
 */
export async function getBrowserIdentity(req: Request, res: Response, db: any): Promise<string> {
  const token = cookieToken(req, BROWSER_ID_COOKIE);
  if (/^[a-f0-9]{64}$/.test(token)) {
    const found = rows(await db.execute(sql`SELECT token_hash FROM request_browser_identities
      WHERE token_hash = ${hash(token)} AND expires_at > now()`))[0];
    if (found) return found.token_hash;
  }
  const issued = randomBytes(32).toString("hex");
  const digest = hash(issued);
  await db.execute(sql`INSERT INTO request_browser_identities(token_hash, expires_at)
    VALUES (${digest}, now() + interval '90 days')`);
  res.append("Set-Cookie", `${BROWSER_ID_COOKIE}=${issued}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7776000${process.env.NODE_ENV === "production" || req.secure ? "; Secure" : ""}`);
  return digest;
}

export async function getReservationOwner(req: Request, res: Response, db: any): Promise<string> {
  const browser = await getBrowserIdentity(req, res, db);
  const session = cookieToken(req, "veltrix_customer_session");
  if (/^[a-f0-9]{64}$/.test(session)) {
    // Same session validity rules as customer auth, never accept a body customerId.
    const customer = rows(await db.execute(sql`SELECT c.id FROM customer_sessions s
      JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ${hash(session)}
      AND s.expires_at > now() AND s.password_fingerprint = md5(c.password) LIMIT 1`))[0];
    if (customer) return hash(`customer:${customer.id}`);
  }
  return hash(`browser:${browser}`);
}