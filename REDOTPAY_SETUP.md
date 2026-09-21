# RedotPay hosted checkout — implementation and release gate

**Do not enable or deploy this integration yet.** This change is a bounded,
disabled implementation, not a certification that the existing store is safe for
live acquiring. No production migration, payment, email, or Vercel environment
change was performed. Replit configuration records production mode, key version 1,
and the user-approved rate of MVR 15.42 per USD; that does not enable checkout.

## Blocking release findings

1. The existing regular-stock deduct/restore code is a read/modify/write operation
   outside a transaction (and differs between development and Vercel). Legacy COD,
   bank and POS checkout can race the new transactional RedotPay reservation and
   overwrite its stock update. Before enabling payments, inventory mutation paths
   must use the same transactional row locks, with an end-to-end concurrency test.
   Pre-order deduction already uses row locks, but its legacy restore also needs
   review. This patch intentionally does not broadly rewrite legacy checkout.
2. Admin login returns a profile, not a server-validated session. Existing public
   order mutations can otherwise forge confirmation/cancellation. The shared
   guard now blocks **all mutations of RedotPay orders** on these routes, including
   status, delivery, notes and balance invoicing. This is fail-closed, but means
   RedotPay fulfillment cannot use the existing admin mutation UI. A narrowly
   authenticated operator flow must be added before release; do not remove the
   guard to make the UI work. Existing public product/coupon mutation endpoints
   also require deployment-level authentication to protect trusted pricing.
3. Add distributed request throttling/reservation abuse protection before
   enabling anonymous live checkout. No background recovery job is included.
   An operator reconciliation process is needed for provider timeouts, missing
   provider orders, and abandoned reservations; do not clear uncertain
   reservations or issue a second payment without authoritative proof.
4. Validate the exact Vercel webhook raw-body behavior in a non-live provider
   test environment, including retries and close-versus-pay races. This adapter
   currently supports production configuration only; tests use injected mocks,
   not provider sandbox/live requests. Complete controlled sandbox acceptance
   before any live rollout.

`REDOTPAY_ENABLED` is not set by this change and must remain unset/false while
these findings are unresolved. Runtime readiness also checks the explicit public
origin, merchant key, key version, exchange rate and migration.

## Vercel configuration after release blockers are resolved

Configure on Vercel independently of Replit:

| Name | Value |
| --- | --- |
| `REDOTPAY_PRIVATE_KEY` | Existing PKCS8 RSA private key, server secret; PEM newlines or escaped `\n` supported |
| `REDOTPAY_APP_KEY` | Existing merchant app key, server secret |
| `REDOTPAY_ENVIRONMENT` | `production` |
| `REDOTPAY_KEY_VERSION` | `1`, matching merchant public key upload version |
| `REDOTPAY_MVR_PER_USD` | `15.42` |
| `REDOTPAY_PUBLIC_ORIGIN` | Actual canonical HTTPS production origin only, with no path/query/credentials |
| `REDOTPAY_ENABLED` | `true` **only after the blocking review and acceptance testing** |

The production origin is not known and is deliberately not inferred from Host or
forwarded headers. Never put keys in `VITE_*` variables. Upload the merchant
public key matching the private key to RedotPay, confirm the production merchant
app is approved, and configure any provider IP allowlist with the deployment's
actual egress design.

Apply `script/redotpay-migration.sql` manually in Supabase SQL Editor after review
and backup. It is idempotent and creates isolated payment tables; no existing
order columns are added, so missing payment tables do not break COD/bank reads or
inserts. RLS and revoked browser-role access protect payment capabilities. The
server DB role must own/have access to those tables.

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

## Verification performed / commands

- `npx tsx --test script/redotpay.test.ts`: isolated RSA fixtures, mocked provider
  transport, quote tamper rejection, public-origin validation, raw signature
  verification, legacy route guards for both result shapes, idempotent
  reconciliation and missing-migration readiness. No DB/network payment calls.
- `npm run check`: existing unrelated errors in AdminPanel's POS type and
  AdminPermissions type must be reviewed separately.
- `npm run build`: local build only.
- `npx esbuild api/index.ts --bundle --platform=node --format=esm --packages=external --outfile=/tmp/redotpay-vercel-check.mjs`
  checks Vercel's actual entrypoint separately from the development build.

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