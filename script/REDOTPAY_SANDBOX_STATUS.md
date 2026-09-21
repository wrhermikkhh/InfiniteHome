# Sandbox database preparation

## Completed on 2026-09-21

- The separately supplied sandbox connection was validated against the configured
  live Supabase project reference and confirmed different. Credentials and project
  identifiers are intentionally not recorded here.
- The new sandbox's public schema was empty before initialization.
- Base-table SQL was generated from `shared/schema.ts` with Drizzle, without
  pointing Drizzle at any database.
- Applied the generated base SQL, then `admin-security-migration.sql`,
  `redotpay-migration.sql`, and `inventory-safety-migration.sql`, in that order.
  The RedotPay script's outer transaction delimiters were removed in memory so
  all initialization and permission hardening ran in one transaction.
- Enabled RLS on every application table and revoked table and sequence access
  from `PUBLIC`, `anon`, and `authenticated`. Browser execution of the payment
  immutability trigger function was also revoked.
- Verification before commit found 21 application tables, all with RLS enabled,
  no browser-role table privileges, retained server-role access, schema markers
  1 and 2, the enabled payment immutability trigger, no unvalidated constraints,
  and no business records. Only schema-version marker rows were inserted.

No production database changes, live order/inventory copies, payment creation,
Vercel settings changes, or publishing occurred during this preparation.

## Still required

This is database setup evidence, not checkout or concurrency acceptance.

- Create an isolated Vercel Preview with sandbox-only database, storage, session,
  and provider settings. Do not inherit live Supabase or email credentials.
- Confirm the exact preview origin before sending webhook tests.
- Provision disposable test products and operator access without copying live data.
- Perform the remote webhook, provider sandbox, and deployed-database acceptance
  described in `REDOTPAY_ACCEPTANCE.md`.
- Keep live payment activation and production migrations separate and unapproved.

The sandbox is no longer empty. Do not rerun an empty-database bootstrap or use
an unreviewed schema push against it.