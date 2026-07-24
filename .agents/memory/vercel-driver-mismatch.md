---
name: Vercel postgres-js result shape
description: Raw SQL via db.execute() returns different shapes in dev vs Vercel prod — must handle both.
---

# Vercel postgres-js result shape

The Vercel production handler (`api/index.ts`) uses the `postgres-js` driver, where `db.execute(sql...)` returns the row array **directly** (a RowList). The dev server uses node-postgres, where the result is `{ rows: [...] }`.

**Why:** Accessing `result.rows[0]` in the Vercel handler crashed every order/POS creation on the live site with "Cannot read properties of undefined (reading '0')" — while dev worked fine, making it look like a schema problem.

**How to apply:** Any raw `db.execute()` result in code shared/mirrored between `server/` and `api/index.ts` must handle both shapes: `const row = Array.isArray(result) ? result[0] : result.rows?.[0]`. Drizzle query-builder calls (select/insert/update) are unaffected — only raw SQL.
