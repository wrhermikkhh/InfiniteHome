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

- Publish the updated code as an isolated Vercel Preview, not production.
- Confirm the exact preview origin before sending webhook tests.
- Provision disposable test products and operator access without copying live data.
- Perform the remote webhook, provider sandbox, and deployed-database acceptance
  described in `REDOTPAY_ACCEPTANCE.md`.
- Keep live payment activation and production migrations separate and unapproved.

The sandbox is no longer empty. Do not rerun an empty-database bootstrap or use
an unreviewed schema push against it.

## Vercel Preview configuration prepared on 2026-09-21

- Saved 19 settings scoped only to Preview: the sandbox database and provider
  credentials, the expected sandbox project reference, disabled payment gates,
  and empty storage/email/cron/origin/fixture settings.
- Removed Preview from the four previously shared live storage/email variable
  scopes. Their Production and Development targets and stored values were
  verified unchanged. The production database setting was also unchanged.
- Branch-scoped setup was rejected because the proposed Git branch does not
  exist. Preview-wide setup was used only after confirming there were no existing
  preview deployments or branch overrides. No Git branch was pushed.
- Vercel deployment protection remains enabled. Remote webhook acceptance still
  needs a reviewed way for its sender to reach the preview; do not claim it is
  reachable or disable protection on the production project.
- Added a runtime Preview guard before database, storage, and mail initialization.
  Production/development behavior is unchanged. It rejects mismatched databases,
  live payment configuration, inherited mail/storage/cron credentials, and unsafe
  or missing origins when enabling payments or fixture acceptance.
- Verification: TypeScript, 30 offline preview/payment tests, application build,
  Vercel entrypoint bundle, running development workflow, and storefront screenshot
  passed. A local invocation of the Vercel entrypoint using the real sandbox
  database returned healthy DB status, an empty product list, and disabled payment
  readiness. The unauthenticated email-status request returned 401, not a public
  status response; no email was sent.

No Vercel deployment, external webhook test, provider payment creation, production
migration, or live payment activation has occurred. Empty origins deliberately
prevent acceptance/checkout activation before a preview URL is confirmed.