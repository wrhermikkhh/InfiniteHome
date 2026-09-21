# INFINITE HOME Vercel deployment and rollout

This operator guide does not authorize a deployment. No Vercel deployment,
production migration, provider transaction, or live activation was performed by
the RedotPay work. The confirmed canonical production origin is
`https://infinite-home.vercel.app`; an isolated Preview origin remains
unconfirmed.

## Prerequisites and ownership

- Vercel project connected to the reviewed repository and commit.
- External serverless-compatible PostgreSQL connection, with backup/restore
  tested. For Supabase, use the transaction pooler.
- Supabase Storage and server-side service credentials when uploads are needed.
- Named deployment, database, inventory, admin-security, and rollback owners.
- All gates in `REDOTPAY_SETUP.md` reviewed, with RedotPay still disabled.

Use the checked-in `vercel.json`, Framework Preset **Other**, and `npm install`.
The Vercel Express function in `api/index.ts` delegates to the same
`server/routes.ts` and `server/storage.ts` implementation used elsewhere; do not
reintroduce a mirrored backend or add a Next.js `api.bodyParser` setting. The
shared server implementation must preserve the exact raw request bytes used for
webhook verification. Prove that behavior with the isolated Preview harness
rather than assuming local middleware behavior is identical on Vercel.

## Required environment

Set secrets in Vercel environment settings, never in source, evidence, client
bundles, or `VITE_*` variables.

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Intended serverless PostgreSQL database |
| `ADMIN_PUBLIC_ORIGIN` | `https://infinite-home.vercel.app` exactly |
| `RESEND_API_KEY` | Required when production email is enabled |
| `SUPABASE_URL` | Required for configured uploads |
| `SUPABASE_SERVICE_KEY` | Server-only service-role credential |

Preview and production must not silently share origins, data, or credentials.
Do not use wildcard admin CORS or derive the trusted origin from forwarding
headers.

### RedotPay variables: keep disabled

| Variable | Eventual production value |
| --- | --- |
| `REDOTPAY_ENABLED` | exact `true` only at final enablement |
| `REDOTPAY_LIVE_APPROVED` | exact `true`, independent final gate |
| `REDOTPAY_ENVIRONMENT` | `production` |
| `REDOTPAY_PRIVATE_KEY` | approved merchant RSA private key, server-only |
| `REDOTPAY_APP_KEY` | approved merchant app key, server-only |
| `REDOTPAY_KEY_VERSION` | matching merchant public-key upload |
| `REDOTPAY_MVR_PER_USD` | `15.42` |
| `REDOTPAY_PUBLIC_ORIGIN` | `https://infinite-home.vercel.app` exactly |

Until final approval, leave both live gates absent/false. Credentials alone must
not expose checkout. Sandbox acceptance requires provider-issued sandbox
merchant credentials; do not use production credentials or invent a sandbox.

Preview-only raw-body acceptance variables and their public-key override are
documented in `script/REDOTPAY_ACCEPTANCE.md`. They require
`VERCEL_ENV=preview`, an exact opt-in, and disabled checkout. Remove them after
the probe. Never deploy the fixture private key.

## Database migration order

Do not deploy the current application until all three prerequisites are present.

1. Keep the old application serving and RedotPay disabled.
2. Confirm the exact database and create a reviewed backup.
3. Review and manually apply, with the approved server role:
   `script/admin-security-migration.sql`, then
   `script/redotpay-migration.sql`, then
   `script/inventory-safety-migration.sql`.
4. Verify customer/admin sessions, both throttle mechanisms, customer email
   proofs, the canonical `legacy_inventory_reservations` ledger and its
   reconciliation audit fields, RedotPay objects and audit objects;
   schema versions; indexes; constraints; triggers; RLS/revocations; and
   server-role access.
5. If `inventory_sales` exists from an earlier incoming deployment, review it
   as historical evidence. Do not silently rename/copy it or infer allocations.
   Import only independently verified outstanding allocations through
   `script/LEGACY_INVENTORY_OPERATIONS.md`.
6. Require every administrator with an old MD5-era session to sign in again;
   do not migrate or trust old session tokens.
7. Record the reviewed evidence.

Do not blindly run `drizzle-kit push` against production. Protected raw-SQL
objects are not all represented in the Drizzle schema. The migration was tested
on disposable PostgreSQL but was not applied to production.

## Preview acceptance before production

Use an isolated Vercel Preview, isolated acceptance database, and non-production
credentials. Keep production data and both production live gates out of it.

Run the acceptance harness from `script/REDOTPAY_ACCEPTANCE.md`, including
exact-byte callback verification, retries/tampering, trusted-proxy behavior,
admin session and permission changes, shared throttles, and deployed inventory
contention. Then run provider-issued sandbox create/detail/close and race cases.
Capture only redacted evidence and remove fixture settings afterward.

The merged local suite passes all 107 tests, TypeScript and both builds. Earlier
isolated PostgreSQL checks passed; the combined migration sequence requires
isolated acceptance before rollout. None of these checks are Vercel, provider,
deployed-database, or production acceptance.

## Production deployment sequence

1. Verify all three migrations in order and reviewed historical allocation work.
2. Deploy the compatible application with RedotPay disabled.
3. Require administrators to sign in again, including holders of old MD5-era
   sessions; persisted browser profiles and old session rows are not authority.
4. Smoke-test logout, permission removal, password invalidation, COD/bank/POS,
   inventory restore, uploads, email, health, and recovery visibility.
5. Complete and independently review all external acceptance.
6. Configure the provider webhook:
   `https://infinite-home.vercel.app/api/payments/redotpay/webhook`.
7. Configure production RedotPay credentials and origin, still leaving both
   gates disabled. Return URL:
   `https://infinite-home.vercel.app/payment/redotpay`.
8. In a separately approved window, enable both gates, perform only the approved
   capped transaction, reconcile it, and monitor.

Do not combine migration, initial deployment, historical reconciliation,
provider acceptance, and live enablement.

## Operations, storage, and rollback

- Monitor database/API health, 401/403/429 rates, auth throttling, nonterminal
  reservations, recovery audits, provider errors, signature failures, and
  legacy restoration errors.
- Never delete payment attempts, operator audit, or allocation ledgers as
  cleanup, and never release stock based on age.
- Treat `started` or `uncertain` recovery audits as incidents requiring
  authoritative provider detail.
- Keep shared limits fail-closed; do not trust caller-supplied network identity.
- Use the `infinite-home` Supabase Storage bucket with minimum required policy.
  Never expose the service-role key or make sensitive payment slips public.

After new session or allocation-ledger writes begin, an old application is not a
safe automatic rollback. Disable RedotPay first, pause conflicting writes when
needed, preserve schema/audit evidence, reconcile in-flight state, and roll
forward to a reviewed compatible build.

## Troubleshooting without weakening controls

- Database unavailable: verify the connection, pooler, SSL, migration, and role
  grants; do not bypass readiness.
- Admin sign-in failure: verify migration v2, exact `ADMIN_PUBLIC_ORIGIN`,
  cookies, throttling, and current account state.
- Signature failure: compare exact raw bytes, environment, platform-key pin, and
  key version; never re-stringify JSON or skip verification.
- Inventory ambiguity: stop mutation and use reviewed reconciliation evidence;
  never repair it with direct payment-state or stock edits.
