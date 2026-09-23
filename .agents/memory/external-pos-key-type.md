---
name: External POS key type
description: A live Supabase schema difference that affects POS-linked migrations.
---

The external live database uses PostgreSQL `uuid` for POS transaction IDs, while development uses `varchar`. New POS-linked foreign key columns in live migrations must use the target database's `uuid` type; leave the development schema's `varchar` declarations intact.

**Why:** A migration that succeeded and safely reran in development rolled back on the external live target because PostgreSQL cannot implement a `varchar` foreign key to a `uuid` primary key. The failed transaction did not create partial ledger objects.

**How to apply:** Before any future external POS-linked schema migration, inspect actual parent key types on that target and adapt child key types accordingly. Validate that orders, admins, and products keep their expected types as well. Never infer live types from the development ORM schema alone.