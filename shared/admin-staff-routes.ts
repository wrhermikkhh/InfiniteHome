import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { securityRows } from "./admin-security.js";

type Queryable = { execute: (query: any) => Promise<any> };
type Database = Queryable & {
  transaction: <T>(callback: (tx: Queryable) => Promise<T>) => Promise<T>;
};

export const staffUserInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
}).strict();

export async function lockEmailIdentity(db: Queryable, email: string): Promise<void> {
  // Both admin and staff creation acquire this lock inside one transaction.
  // The subsequent checks use a fresh READ COMMITTED snapshot after waiting.
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email.toLowerCase()})::bigint)`);
}

export async function staffEmailExists(db: Queryable, email: string): Promise<boolean> {
  return securityRows(await db.execute(sql`
    SELECT 1 FROM staff_users WHERE lower(email) = ${email.toLowerCase()} LIMIT 1
  `)).length > 0;
}

export function registerAdminStaffRoutes(app: Express, getDb: () => Database): void {
  // registerAdminAuth + registerAdminSecurity run first. Both methods are
  // super-admin-only through the /api/admin/ policy, including GET.
  app.get("/api/admin/staff-users", async (_req, res) => {
    try {
      const staff = securityRows(await getDb().execute(sql`
        SELECT id, name, email, status, created_at AS "createdAt"
        FROM staff_users ORDER BY created_at DESC, id DESC
      `));
      res.json(staff);
    } catch {
      res.status(503).json({ message: "User records could not be loaded." });
    }
  });

  app.post("/api/admin/staff-users", async (req, res) => {
    const parsed = staffUserInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Enter a valid name and email." });
      return;
    }
    const { name, email } = parsed.data;
    try {
      const db = getDb();
      const staff = await db.transaction(async tx => {
        await lockEmailIdentity(tx, email);
        const admin = securityRows(await tx.execute(sql`
          SELECT 1 FROM admins WHERE lower(email) = ${email} LIMIT 1
        `));
        if (admin.length) return null;
        return securityRows(await tx.execute(sql`
          INSERT INTO staff_users (name, email) VALUES (${name}, ${email})
          RETURNING id, name, email, status, created_at AS "createdAt"
        `))[0];
      });
      if (!staff) {
        res.status(409).json({ message: "This email already belongs to an admin." });
        return;
      }
      res.status(201).json(staff);
    } catch (error: any) {
      if (error?.code === "23505" || error?.cause?.code === "23505") {
        res.status(409).json({ message: "This user email is already in use." });
        return;
      }
      res.status(503).json({ message: "User could not be added." });
    }
  });
}