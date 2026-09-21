# RedotPay controlled acceptance plan

This is a release checklist, not evidence that acceptance has happened. The
user-confirmed canonical production origin is
`https://infinite-home.vercel.app`, but the required separate isolated Vercel
Preview origin is still unknown. It is not an acceptance target. Do not run this
plan against production, infer an origin from request headers, or invent a
provider sandbox.

## Evidence levels

- `script/redotpay.test.ts` is **local/mocked** evidence only. It does not test
  Vercel, a provider environment, deployed database locking, or real close/pay
  behavior.
- `script/redotpay-vercel-acceptance.ts` is **actual remote Vercel transport**
  evidence, but only for exact raw webhook bytes, retry handling at the
  signature boundary, and tamper rejection. It deliberately names a nonexistent
  payment, expects `404 No payment found` after successful verification, and
  therefore cannot query or mutate provider/payment/order/stock state.
- Controlled close/pay and concurrency runs are **actual end-to-end** evidence
  only when performed against a provider environment and merchant credentials
  explicitly supplied and approved by RedotPay. None is currently known. Never
  relabel mocks or this raw-body probe as provider acceptance.

## Raw-body probe: mandatory gates

Use only an isolated Vercel Preview deployment and acceptance database. The user
must confirm the exact `*.vercel.app` origin and that it is not an alias serving
production. Keep the fixture order ID absent from that database. Do not use a
production/live provider key or endpoint.

The deployed verifier must trust the public half of a dedicated acceptance
fixture key, or RedotPay must supply a signed fixture through an approved
non-live environment. The current application pins RedotPay's production
platform public key, so a locally generated key will not pass it. A payment
worker may add an acceptance-only verifier key override only under this contract:

1. fail unless `VERCEL_ENV=preview`, `REDOTPAY_ENABLED` is false, and a separate
   exact acceptance opt-in is set;
2. accept a public key only (never deploy the fixture private key);
3. make the override impossible in production and keep the production pin as
   the default;
4. remove/unset the override after the probe; and
5. do not alter reconciliation, order, inventory, or provider request behavior.

The fixture private key or a precomputed signature is supplied to the runner
only through runtime environment variables. The harness does not print keys,
signatures, response bodies, or app keys.

Required runner variables:

```text
REDOTPAY_ACCEPTANCE_ENABLED=I_ACCEPT_NON_PRODUCTION_WEBHOOK_TESTS
REDOTPAY_ACCEPTANCE_DEPLOYMENT_KIND=vercel-preview
REDOTPAY_ACCEPTANCE_ORIGIN=https://<user-confirmed-preview>.vercel.app
REDOTPAY_ACCEPTANCE_CONFIRMED_ORIGIN=https://<same-preview>.vercel.app
REDOTPAY_ACCEPTANCE_APP_KEY=<acceptance verifier app key>
REDOTPAY_ACCEPTANCE_WEBHOOK_PRIVATE_KEY=<acceptance fixture RSA private key>
```

Alternatively set both `REDOTPAY_ACCEPTANCE_TIMESTAMP` and
`REDOTPAY_ACCEPTANCE_SIGNATURE` for an approved signature over the script's
exact fixed fixture. Do not set the private key in that mode. Run manually:

```sh
npx tsx script/redotpay-vercel-acceptance.ts
```

The only passing sequence is: exact bytes `404`, identical retry `404`,
whitespace-normalized body `401`, semantic tamper `401`. Save the harness JSON,
deployment ID/commit, acceptance configuration review, and Vercel request
records with secrets redacted. A `200` is a failure for this nonexistent ID.

## Exact Vercel raw-body recommendation

For this Express Vercel function, keep
`express.json({ verify: (_req, _res, buf) => rawBody = buf })` registered before
all routes and before any other JSON/body consumer. Pass that `Buffer` directly
to signature verification and parse JSON only through the same middleware.
Do not reconstruct bytes with `JSON.stringify(req.body)`.

There is no raw-body switch to add under this repository's `vercel.json`
`functions` entry. Do not copy Next.js Pages Router
`export const config = { api: { bodyParser: false } }` into this Express
function; it is not the parser controlling this entrypoint. The acceptance probe
must confirm that the Vercel Node runtime leaves the stream for Express. If the
exact fixture does not reach the post-verification `404`, stop release rather
than weakening verification.

## Controlled provider close/pay acceptance (blocked until approved)

Gate every run on a user-confirmed non-live provider environment, dedicated
merchant, disposable product/order, isolated DB, explicit spend ceiling, named
operator, and rollback/reconciliation owner. If RedotPay offers no sandbox or
test merchant, record this as blocked; do not test on live.

For each case record provider order ID, merchant order ID, local state changes,
authoritative detail responses with sensitive fields redacted, inventory before
and after, timestamps, and duplicate-call counts:

1. create once; retry the same browser capability concurrently; prove one
   provider create and one reservation;
2. deliver the same signed paid webhook concurrently and retry status; prove one
   confirmation and no second stock deduction;
3. request close before payment; prove authoritative `closed`, one restoration,
   and idempotent retries;
4. race close against payment; accept only the provider's authoritative terminal
   outcome, never both restore stock and confirm fulfillment;
5. simulate create/detail timeout and delayed webhook; prove no second charge
   and reservation remains for reconciliation;
6. reject wrong amount, currency, merchant ID, provider ID, signature, key
   version, and altered raw bytes.

Do not enable `REDOTPAY_ENABLED=true` merely to run the raw-body probe.

## Concurrent COD/POS/reservation acceptance

The shared locking and allocation-ledger implementation has passed local
PostgreSQL tests, but this deployed-database gate remains mandatory to validate
the completed inventory work in the actual serverless path. On an isolated
acceptance DB, seed one SKU and one variant with deliberately scarce stock, then
synchronize requests at the same transaction boundary:

1. RedotPay reservation versus COD checkout for the last unit;
2. RedotPay reservation versus POS sale for the last unit;
3. RedotPay close/restoration versus concurrent COD and POS sale;
4. paid webhook/status retries during those races; and
5. the same matrix for preorder total stock and variant stock.

Passing evidence must show row-lock/atomic-write behavior, no negative or lost
inventory, at most the available quantity allocated, one reservation per
capability, one restoration only after authoritative closure, and no restoration
after payment. Repeat enough times to exercise contention and retain DB
transaction traces with customer data and credentials removed. Until this actual
deployed-DB matrix passes, live enablement remains blocked.
