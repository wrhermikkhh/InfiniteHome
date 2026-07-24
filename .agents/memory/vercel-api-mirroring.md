---
name: Vercel api/index.ts mirroring
description: Vercel prod serves api/index.ts, a deliberate duplicate of server logic — all changes must be applied in both places.
---

# Vercel api/index.ts mirroring

Vercel production serves `api/index.ts`, which duplicates `server/routes.ts` logic and the Drizzle schemas inline (by design, for serverless bundling).

**Why:** Prod does not use `server/` at all. A change made only in `server/` works in dev but silently never reaches the live site.

**How to apply:** Every route, storage-logic, or schema change in `server/` or `shared/schema.ts` must be replicated in `api/index.ts` in the same task.
