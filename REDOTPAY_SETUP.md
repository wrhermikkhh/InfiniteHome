# RedotPay hosted checkout: operator and release guide

## Current release status

**Keep `REDOTPAY_ENABLED` and `REDOTPAY_LIVE_APPROVED` absent/false. Do not
deploy or enable live payments from this work alone.**

The safety implementation is prepared, but no production migration, Vercel
deployment or acceptance, provider sandbox/production transaction, or
production data mutation was performed. The merged local suite passes all 107
tests; TypeScript and both deployment-entry builds pass. Earlier isolated
PostgreSQL inventory/concurrency and migration checks passed; the newly combined
migration sequence still requires isolated acceptance before rollout.

That evidence covers local logic and isolated SQL behavior only. It does not
prove Vercel raw-body transport, a deployed database, merchant configuration,
provider callbacks, or a live payment.

The user-confirmed values are:

- exchange rate: MVR 15.42 per USD;
- canonical production origin: `https://infinite-home.vercel.app`.

An isolated Vercel Preview origin is still unconfirmed. Never infer either
origin from `Host` or forwarded headers.

## Provider environments and variables

Never put secrets in `VITE_*` variables.

| Name | Sandbox acceptance | Production |
| --- | --- | --- |
| `REDOTPAY_ENABLED` | `true` only for approved isolated acceptance | `true` only after every gate |
| `REDOTPAY_ENVIRONMENT` | `sandbox` | `production` |
| `REDOTPAY_LIVE_APPROVED` | not a sandbox substitute | exact `true`, final independent live gate |
| `REDOTPAY_PRIVATE_KEY` | provider-issued sandbox merchant key | approved production merchant key |
| `REDOTPAY_APP_KEY` | provider-issued sandbox app key | approved production app key |
| `REDOTPAY_KEY_VERSION` | matching merchant key upload | matching merchant key upload |
| `REDOTPAY_MVR_PER_USD` | `15.42` | `15.42` |
| `REDOTPAY_PUBLIC_ORIGIN` | confirmed isolated HTTPS origin | `https://infinite-home.vercel.app` |

Production authentication also requires
`ADMIN_PUBLIC_ORIGIN=https://infinite-home.vercel.app`, exactly, without a
trailing slash. Preview acceptance must use its own confirmed origin and must
not share production credentials or production data.

The documented provider API origins and pinned platform keys are selected by
the adapter. Pins do not provide merchant credentials and do not prove provider
acceptance. Review official provider key-rotation notices before rollout.

Configure the production merchant notification URL only after approval:

`https://infinite-home.vercel.app/api/payments/redotpay/webhook`

Create requests use:

`https://infinite-home.vercel.app/payment/redotpay`

## Implemented safety properties

- Quotes, coupon eligibility, shipping, and MVR-to-USD conversion are
  server-authoritative; USD cents are rounded once from MVR cents at 15.42.
- Stock reservation and order/payment state changes use transactional,
  idempotent paths.
- Webhooks verify exact raw bytes, then reconcile authoritative provider detail.
  Browser return alone never confirms payment.
- Payment and admin throttles are shared in PostgreSQL and fail closed when the
  database or trustworthy client identity is unavailable.
- Admin mutation and recovery routes require server-validated sessions and
  current database permissions.
- Recovery actions require a reason and durable audit evidence; they do not
  locally mark a payment paid/closed or release stock.
- Disabling checkout does not prevent valid signed callbacks or recovery of
  existing attempts.

Do not release stock because a browser was abandoned, a local timer expired, or
a child payment failed. Only authoritative closed state restores exactly once;
paid state never restores.

## Mandatory migration order

After review and backup, apply these additive scripts with the intended server
role, in this order, **before deploying the new application even with RedotPay
disabled**:

1. `script/admin-security-migration.sql` creates the customer sessions,
   customer email proofs, and shared security-limit table. It also creates the
   compatible `admin_sessions` shape if it is not already present.
2. `script/redotpay-migration.sql` installs schema version 2, the canonical
   admin throttle and `admin_sessions` prerequisites used by
   `shared/admin-auth.ts`, the canonical `legacy_inventory_reservations` ledger,
   and RedotPay state, limits, audit, constraints, RLS, and revocations.
3. `script/inventory-safety-migration.sql` idempotently adds the reviewed
   reconciliation audit fields to `legacy_inventory_reservations` and reapplies
   its browser-role protections.

The application has one admin-session implementation in `shared/admin-auth.ts`.
`shared/admin-security.ts` reuses that authenticated admin and retains customer
sessions, email verification, atomic hashed one-time codes/limits, and policy
read guards; it must not create a second admin authority. Existing MD5-era admin
session records/cookies are not compatible with the SHA-256 token hashes and
must not be translated or trusted. Require administrators to sign in again.

Verify all three scripts' tables, columns, indexes, constraints, triggers,
schema versions, grants, RLS/revocations, and server-role access. Do not use
`drizzle-kit push` as a substitute; protected raw-SQL objects are not all
represented by Drizzle. This repository prepared and tested the scripts only.
It did not apply them to production.

If an earlier incoming inventory implementation created `inventory_sales`,
stop and review its rows against source evidence. Import only independently
verified outstanding allocations into `legacy_inventory_reservations` through
the reviewed reconciliation process, preserving release/restoration meaning
and audit evidence. There is deliberately no silent schema rename, copy, or
automatic backfill.

Historical orders and POS transactions do not automatically have trustworthy
allocations. Follow `script/LEGACY_INVENTORY_OPERATIONS.md` and use
`script/legacy-inventory-reconcile.ts` only with independent evidence and
approval. Never infer old deductions from order lines or current stock.

## Required acceptance

Follow `script/REDOTPAY_ACCEPTANCE.md` and retain redacted evidence for:

1. isolated Vercel Preview exact-byte webhook delivery, retries, whitespace and
   semantic tampering, proxy handling, and cross-instance throttling;
2. provider-issued sandbox create/detail/close, delayed/retried callback,
   interruption, mismatch, duplicate, and close-versus-pay scenarios;
3. isolated deployed-database COD, bank, POS, RedotPay, variant, preorder,
   cancellation, restoration, and contention scenarios; and
4. admin login/logout/expiry/password invalidation, live permission removal,
   recovery authorization, and audit behavior.

The preview-only raw-body fixture described by the acceptance guide requires an
explicit Preview opt-in and disabled checkout. Remove fixture settings after the
probe and never deploy a fixture private key.

## Rollout and rollback

1. Keep the old deployment serving and both RedotPay gates disabled.
2. Back up and apply/verify the three migrations in the documented order.
3. Review historical allocations without guessing.
4. Deploy the compatible application with RedotPay disabled; require admins,
   including holders of old MD5-era sessions, to sign in again and smoke-test
   auth, inventory, COD/bank/POS, uploads, email, health, and recovery visibility.
5. Complete isolated Vercel, deployed-database, and provider sandbox acceptance.
6. Configure production origins, credentials, webhook, monitoring, and recovery
   ownership while leaving both gates disabled.
7. In a separately approved change window, enable both gates, perform only the
   explicitly approved capped transaction, reconcile it, and monitor.

Do not combine migration, first deployment, historical reconciliation, provider
acceptance, and live enablement into one irreversible change.

After new session or allocation-ledger writes begin, old application code is not
a safe automatic rollback. First disable RedotPay, pause conflicting inventory
writes if needed, preserve schema and audit evidence, reconcile in-flight
payments and allocations, and roll forward to a reviewed compatible build.

## Official protocol references

- https://redotpay.readme.io/llms.txt
- https://redotpay.readme.io/docs/getting-started.md
- https://redotpay.readme.io/reference/createprepayorder-1.md
- https://redotpay.readme.io/docs/redotpay-api-request-signature-and-verification-guide.md
- https://redotpay.readme.io/docs/webhook.md
- https://redotpay.readme.io/reference/paymentorderdetail-1.md
- https://redotpay.readme.io/reference/closeorder.md
