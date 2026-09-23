---
name: Document database targets
description: Environment-specific document schema rollout for this project's mixed Replit and external Supabase databases
---

The development app's document table can be in Replit's development PostgreSQL, while the separately connected Supabase sandbox and live project each have their own document table. Do not assume updating either Supabase project also updates the development app, or that publishing code migrates the external live database.

**Why:** An additive quotation field existed in neither external project nor the development PostgreSQL. Updating both Supabase schemas still left the running development app's table unchanged.

**How to apply:** Before code begins selecting a new document column, check the target schema in all three environments, apply additive migrations independently to each applicable target, and verify the live catalog identifies the intended production Supabase project without exposing connection credentials.