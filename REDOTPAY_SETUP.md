# RedotPay hosted checkout — safe rollout

**Live activation remains gated on external setup and provider acceptance.**
The safety implementation includes server-validated sessions, permission checks,
atomic inventory reservations, guarded stock edits, payment throttling, and
authenticated recovery/fulfillment tools. No production migration, payment,
email, or Vercel environment change has been performed by this work.
Replit configuration records production mode, key version 1, and the
user-approved rate of MVR 15.42 per USD; that does not enable checkout.

## Required deployment sequence

1. Review the additive migrations below and take the normal Supabase backup.
   Apply all required migrations **before** deploying the new auth/inventory
   code. Existing customer/product/order data and stock quantities are not
   automatically changed or backfilled.
2. Confirm an approved existing super-admin account is available. Existing
   admins and customers must sign in again to obtain secure server sessions.
   Review `ADMIN_SECURITY_SETUP.md` for permission and account-history changes.
3. Configure Vercel server-side secrets/settings and the actual canonical HTTPS
   origin. Workspace secrets do not automatically configure Vercel.
4. Complete controlled sandbox acceptance of redirects, signed notifications,
   retries, interrupted payments, and cancellation races on Vercel. Offline
   tests do not prove the provider account or deployed raw-body handling works.
5. Configure RedotPay merchant notifications and any provider egress allowlist.
   Configure authenticated scheduled recovery, or assign an operator to run
   recovery regularly. Uncertain payments must not silently release stock.
6. After acceptance, set production credentials/mode and `REDOTPAY_ENABLED=true`
   for the release the user publishes. Verify live readiness and sign-in. A real
   test charge requires separate approval of its exact amount.

Until these steps are complete, leave `REDOTPAY_ENABLED` unset/false. Readiness
checks the origin, credentials, rate and payment migration; it is not a
substitute for deployment acceptance. Disabling new checkout still permits
properly configured signed callbacks and recovery of existing attempts.

## Vercel configuration after release blockers are resolved

Configure on Vercel independently of Replit:

| Name | Value |
| --- | --- |
| `REDOTPAY_PRIVATE_KEY` | Existing PKCS8 RSA private key, server secret; PEM newlines or escaped `\n` supported |
| `REDOTPAY_APP_KEY` | Existing merchant app key, server secret |
| `REDOTPAY_ENVIRONMENT` | `sandbox` for acceptance with sandbox credentials; `production` for live credentials |
| `REDOTPAY_KEY_VERSION` | `1`, matching merchant public key upload version |
| `REDOTPAY_MVR_PER_USD` | `15.42` |
| `REDOTPAY_PUBLIC_ORIGIN` | Actual canonical HTTPS production origin only, with no path/query/credentials |
| `REDOTPAY_ENABLED` | `true` only for the approved, configured environment after acceptance |
| `CRON_SECRET` | Optional server secret for scheduled recovery; never expose it to the browser |

The production origin is not known and is deliberately not inferred from Host or
forwarded headers. Never put keys in `VITE_*` variables. Upload the merchant
public key matching the private key to RedotPay, confirm the production merchant
app is approved, and configure any provider IP allowlist with the deployment's
actual egress design.

Apply these idempotent scripts in Supabase SQL Editor after review and backup:

1. `script/admin-security-migration.sql`
2. `script/inventory-safety-migration.sql`
3. `script/redotpay-migration.sql`

The auth and inventory tables are prerequisites for all updated login and sale
paths, even while RedotPay is disabled. RLS and revoked browser-role access must
protect sessions, ledgers and payment state. The server DB role must retain
access. Do not publish new code first and apply these prerequisites afterward.

Historical orders/POS do not have trustworthy allocation ledgers. Before
cancelling or converting one, an authorized operator must record actual
outstanding stock deductions through **Admin → Inventory → Historical inventory
reconciliation**. This records reviewed evidence, not guessed stock changes.

Set the merchant notification URL in RedotPay to:

`https://<actual-production-host>/api/payments/redotpay/webhook`

The create request sets return URL:

`https://<actual-production-host>/payment/redotpay`

Notification URL is merchant-platform configuration, **not an invented create
request property**. Incoming webhook key version is RedotPay's platform key
version, independent of the merchant signing key version. The published production
platform public key v1 is pinned server-side; review provider key rotations.

## Payment and stock policy

- Server quotes prices, variants, preorder deposits, coupon eligibility and per-item
  express delivery from DB values. Standard/boat shipping remains zero as in the
  existing checkout. Charged USD cents = round(MVR total cents / 15.42).
- The shopper sees and accepts the authoritative MVR total and USD amount before
  checkout creation. Changed totals reject creation.
- Each browser attempt uses a random bearer capability, stored locally, with only
  its hash stored in the private table. The capability is not a query parameter,
  not in order responses and not in the provider return URL.
- A transaction reserves inventory and creates the unpaid order and immutable
  payment expectations. The provider create request is claimed once. Retries
  never silently create a new charge after a timeout.
- Only an authenticated provider detail response matching merchant ID, provider
  ID, USD currency and exact cents can confirm payment. Signed raw webhooks
  trigger the same authoritative query. Browser returns cannot confirm payment.
- Payment confirmation is idempotent and never deducts inventory again.
- Checkout expiry is 30 minutes, but local expiry does **not** release stock.
  Failed child payments, network errors and an abandoned browser retain the
  reservation. Cancel requests first query, close with the provider, then query
  again. Inventory is restored once, only when the provider reports closed.
- Paid and closed outcomes are terminal. No automatic refunds or remaining
  preorder-balance charges are implemented. Payment does not auto-send email.
- Customers can resume the same payment, refresh verified status, or close it.
  A new payment is allowed in the UI only after the previous payment is confirmed
  closed/paid. If local storage is lost, contact the operator; public tracking
  intentionally does not expose the payment capability.
- **Admin → Orders → RedotPay** provides restricted reconciliation, verified
  closure, recovery and forward fulfillment of paid orders with an audit trail.
  Generic order-status endpoints cannot forge RedotPay payment or refunds.
- Authenticated recovery processes bounded work with database leases. If a
  scheduled caller is configured, use `GET /api/payments/redotpay/recover` with
  `Authorization: Bearer <CRON_SECRET>`. Never put that secret in a URL. An
  authorized admin can also run recovery from the operator interface.

## Verification performed / commands

- `npx tsx --test script/admin-security.test.ts script/inventory-safety.test.ts script/redotpay.test.ts`: isolated auth, inventory, RSA fixtures, mocked provider
  transport, quote tamper rejection, public-origin validation, raw signature
  verification, legacy route guards for both result shapes, idempotent
  reconciliation and missing-migration readiness. No DB/network payment calls.
- `npm run check`: full TypeScript check.
- `npm run build`: local build only.
- `npx esbuild api/index.ts --bundle --platform=node --format=esm --packages=external --outfile=/tmp/redotpay-vercel-check.mjs`
  checks Vercel's actual entrypoint separately from the development build.

The combined 72-test offline suite, TypeScript check, application build and
Vercel entrypoint bundle passed. The three migrations were applied successfully
to the Replit development database only. Supabase-specific role revocations are
conditional so the same SQL also works in PostgreSQL development environments
without `anon` or `authenticated` roles.

The proxied-browser admin journey verified real secure cookies, session
persistence, anonymous/forged-storage rejection, restricted server permissions,
operator panels, and logout revocation using disposable development fixtures.
It found a restricted-admin default-tab display bug; that was fixed with
synchronous permission-based rendering, covered by three additional passing
navigation tests and a fresh TypeScript check. The operator panel now also
explains unavailable checkout setup and empty payment lists. Test fixtures were
removed. These checks do not replace external RedotPay acceptance.

The development workflow was restarted for preview verification. Browser checks
use intercepted payment responses only, not real provider transactions.
No deployments, live payments or production data mutations are part of these checks.

## Official protocol sources consulted

- https://redotpay.readme.io/llms.txt
- https://redotpay.readme.io/docs/getting-started.md
- https://redotpay.readme.io/reference/createprepayorder-1.md
- https://redotpay.readme.io/docs/redotpay-api-request-signature-and-verification-guide.md
- https://redotpay.readme.io/docs/webhook.md
- https://redotpay.readme.io/reference/paymentorderdetail-1.md
- https://redotpay.readme.io/reference/closeorder.md

Uses documented v2 `/openapi/v2/order/create`, `/detail`, `/close`, production
host `https://acquirer.redotpay.com`, `X-R-AK`, RSA-SHA256 request signatures,
`orderCurrency: "USD"`, `outerOrderSn`, `orderSn`, `webUrl`, and webhook
`appKey.timestamp.rawBody` verification.