import type { Express } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { securityRows } from "./admin-security.js";

type Database = { execute: (query: any) => Promise<any> };
type Kind = "quotation" | "purchase_order";

const lineItem = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(10000),
  unitPrice: z.number().finite().min(0).max(10000000)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use at most two decimal places"),
}).strict();

const documentInput = z.object({
  partyName: z.string().trim().min(1).max(150),
  contact: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(2000).default(""),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Enter a valid date")
    .nullable().optional(),
  items: z.array(lineItem).min(1).max(50),
  status: z.string().default("draft"),
}).strict();

const statuses: Record<Kind, readonly string[]> = {
  quotation: ["draft", "sent", "accepted", "declined"],
  purchase_order: ["draft", "ordered", "received", "cancelled"],
};

const projection = sql`id, number, kind, party_name AS "partyName",
  contact, notes, due_date AS "dueDate", status, items, total::float8 AS total,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

function validated(input: unknown, kind: Kind) {
  const parsed = documentInput.safeParse(input);
  if (!parsed.success || !statuses[kind].includes(parsed.data.status)) return null;
  const data = parsed.data;
  const total = Math.round(data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
  if (!Number.isFinite(total) || total > 100000000) return null;
  return { ...data, total };
}

export function registerAdminDocumentRoutes(app: Express, getDb: () => Database) {
  for (const [slug, kind, prefix] of [
    ["quotations", "quotation", "Q-"],
    ["purchase-orders", "purchase_order", "PO-"],
  ] as const) {
    const path = `/api/admin/${slug}`;
    app.get(path, async (_req, res) => {
      try {
        const records = securityRows(await getDb().execute(sql`
          SELECT ${projection} FROM admin_documents
          WHERE kind = ${kind} ORDER BY created_at DESC, number DESC`));
        res.json(records);
      } catch (error) {
        console.error("Unable to list admin documents:", error);
        res.status(503).json({ message: "Document storage is unavailable. Check the database migration." });
      }
    });

    app.post(path, async (req, res) => {
      const input = validated(req.body, kind);
      if (!input) return res.status(400).json({ message: "Check the party, date, status and line items." });
      try {
        const document = securityRows(await getDb().execute(sql`
          INSERT INTO admin_documents
            (kind, number, party_name, contact, notes, due_date, status, items, total, created_by)
          VALUES
            (${kind}, ${prefix} || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('admin_document_number_seq')::text, 6, '0'),
              ${input.partyName}, ${input.contact}, ${input.notes}, ${input.dueDate ?? null},
              ${input.status}, ${JSON.stringify(input.items)}::jsonb, ${input.total},
              ${res.locals.admin.id})
          RETURNING ${projection}`))[0];
        res.status(201).json(document);
      } catch (error) {
        console.error("Unable to create admin document:", error);
        res.status(503).json({ message: "Document could not be saved. Check document storage and retry." });
      }
    });

    app.patch(`${path}/:id`, async (req, res) => {
      if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(400).json({ message: "Invalid document ID" });
      const patch = documentInput.partial().safeParse(req.body);
      if (!patch.success || Object.keys(patch.data).length === 0)
        return res.status(400).json({ message: "Check the document changes." });
      try {
        const existing = securityRows(await getDb().execute(sql`
          SELECT ${projection} FROM admin_documents WHERE id = ${req.params.id} AND kind = ${kind}`))[0];
        if (!existing) return res.status(404).json({ message: "Document not found" });
        const input = validated({
          partyName: patch.data.partyName ?? existing.partyName,
          contact: patch.data.contact ?? existing.contact,
          notes: patch.data.notes ?? existing.notes,
          dueDate: patch.data.dueDate !== undefined ? patch.data.dueDate : existing.dueDate,
          status: patch.data.status ?? existing.status,
          items: patch.data.items ?? existing.items,
        }, kind);
        if (!input) return res.status(400).json({ message: "Check the party, date, status and line items." });
        const updated = securityRows(await getDb().execute(sql`
          UPDATE admin_documents SET party_name = ${input.partyName},
            contact = ${input.contact}, notes = ${input.notes},
            due_date = ${input.dueDate ?? null}, status = ${input.status},
            items = ${JSON.stringify(input.items)}::jsonb, total = ${input.total}, updated_at = now()
          WHERE id = ${req.params.id} AND kind = ${kind}
          RETURNING ${projection}`))[0];
        res.json(updated);
      } catch (error) {
        console.error("Unable to update admin document:", error);
        res.status(503).json({ message: "Document could not be updated. Retry." });
      }
    });
  }
}