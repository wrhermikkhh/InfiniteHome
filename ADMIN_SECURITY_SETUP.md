# Admin security deployment

## Required deployment step

Review, back up, and apply these scripts with the intended server role before
deploying the application:

1. `script/admin-security-migration.sql` for `customer_sessions`,
   `customer_email_proofs`, `admin_auth_limits`, and a compatible
   `admin_sessions` prerequisite;
2. `script/redotpay-migration.sql` schema v2 for the canonical
   `admin_sessions`/`admin_auth_throttle`, canonical
   `legacy_inventory_reservations`, and payment security objects; then
3. `script/inventory-safety-migration.sql` to add reconciliation audit fields
   and protections to that canonical inventory ledger.

The scripts are additive/idempotent in that order and do not change existing
accounts or stock quantities. Review and test them on a disposable database
first. The agent has not run them against production.

These private auth, payment, and ledger tables enable RLS without browser
policies and revoke privileges from PUBLIC and, when present, `anon` and
`authenticated`. Use the table owner or a correctly privileged BYPASSRLS server
connection. Do not add browser policies to them.

`api/index.ts` delegates to `server/routes.ts` and `server/storage.ts`, so both
deployments use the same route, auth, and persistence implementation rather than
mirrored backends. `shared/admin-auth.ts` is the single admin-session authority.
`shared/admin-security.ts` reuses its authenticated admin and retains customer
sessions, customer email verification, atomic hashed OTP/limit operations, and
read/policy guards. Missing migration/database errors fail closed.

Existing scrypt password hashes continue working. Existing MD5-era
`admin_sessions` token hashes/cookies do not: do not translate or trust them;
require every administrator to sign in again. Existing plaintext reset codes
cannot be redeemed; request a fresh code after deployment.

The storefront and dashboard must use the same HTTPS origin. Cookies are HttpOnly, SameSite=Strict, Secure on HTTPS/production, host-only, and expire after eight hours. HTTP is supported only for local development. No wildcard/credential-reflecting CORS is enabled. Mutation requests require an exact matching Origin; API scripts must deliberately supply the real app Origin and valid session cookie. Payment webhook routing remains separate and does not require browser Origin.

## Accounts and permissions

- Existing administrators log in with their existing email/password and receive a new SHA-256-hashed opaque session. Old MD5-era sessions and localStorage state are not authority; a page reload validates `/api/admin/session`.
- Super admins can manage admin accounts and grant permissions. Other admins retain the existing five tab permissions. Legacy NULL permissions preserve historical all-tab access but **do not** confer super-admin/account-management privileges.
- Password changes and resets invalidate every previous session immediately; account deletion cascades sessions; logout deletes the session in the database. Self-deletion is refused.
- Confirm an existing, approved `is_super_admin` account is available before rollout. No unauthenticated bootstrap, default password, automatic role promotion, or HTTP repair route is provided. If no super admin exists, an authorized database operator must explicitly approve and promote an existing account offline.
- Product edits cannot change inventory without Stock permission; existing order/POS/payment/inventory routes also enforce their relevant permissions. Inventory reconciliation requires both Stock and Orders privileges.
- New/reset passwords require 8–1024 characters. Existing shorter passwords still authenticate.
- Login/reset budgets use atomic database counters: 10 attempts per account/action per 15 minutes, 3 reset-email requests, plus a broad 600-attempt transport-peer infrastructure budget. The shared `transportPeerBucket` helper does not trust forwarded IP headers or treat a hosting proxy as an individual visitor. Account counters remain authoritative across workers/proxies. Six-digit reset codes use cryptographic randomness, hashed storage, expiry and atomic one-use consumption.

## Customer and storefront compatibility

Public storefront GETs, coupon validation, tracking, payment-slip upload and COD/bank checkout remain public. COD/bank submission is forced to pending and cannot supply invoice, delivery, payment or admin metadata. Provider payments must use their dedicated checkout.

Customer login/signup now also issue an HttpOnly session. Profile, addresses and customer order-history paths require the customer session/ownership or an Orders-authorized administrator. Existing users with only a persisted localStorage login must sign in again once. Customer profile mutations cannot reassign identity/email/password; address mutations cannot change ownership. Customer logout revokes its cookie. Public tracking retains the site's existing tracking-link access model.

**Historical order privacy:** signup/login alone never proves ownership of the entered email. The shared `/api/orders/customer/:email` handler is gated on a server-held `customer_email_proofs` record matching the authenticated customer ID and current email. Missing proof returns `403 EMAIL_VERIFICATION_REQUIRED`, not private order data. No existing accounts are automatically marked verified, and no email-only fallback is permitted.

The Account page offers “Send verification code” and “Verify email and view orders.” Its authenticated, same-origin `/api/customers/verify-email/request` and `/confirm` endpoints send only to the account's database email through the existing Resend email adapter. Client-supplied destinations, verified flags, IDs or headers cannot confer access. Codes are cryptographically generated, stored as hashes, expire after 15 minutes, and are atomically consumed once. DB budgets allow three sends and ten confirmation attempts per mailbox per 15 minutes across sessions/workers; resending does not reset the attempt budget. Once a rightful customer proves inbox access, their historical guest and account orders for that address are available, and verification persists across logins. Users without inbox access cannot claim that email's history. These verification emails do not reset passwords.

## Compatibility and maintenance

`registerAdminAuth` validates the one admin cookie against
`admin_sessions`, expiry, and the current password fingerprint, then stores the
current database-backed admin in `res.locals.admin`.
`getAuthenticatedAdmin` in `shared/admin-security.ts` only consumes that result;
it must never parse or validate a second admin cookie.

`hasAdminPermission(admin, permission)` grants current super admins or the named
boolean permission (NULL legacy permissions mean all five historical tabs). It
does **not** authenticate by itself. Future privileged routes must be registered
through the shared server route stack and its canonical auth/permission mapping.

If an earlier deployment created `inventory_sales`, treat it as historical
evidence only. Review and reconcile each row before importing any outstanding
allocation into `legacy_inventory_reservations`; never silently rename/copy the
table or infer allocations from order lines/current stock.

Expired sessions and old limit rows can be periodically deleted by an authorized scheduled database maintenance job; deletion must only target expired sessions or `window_start < now() - interval '1 day'`. No cleanup schedule is installed here.

Run the scoped offline mocked tests with:

`npx tsx --test script/admin-security.test.ts script/redotpay.test.ts script/inventory-safety.test.ts`

These tests use disposable in-process HTTP listeners with mocked
SQL/email/provider calls, never live credentials or production services. Their
scoped results passed, but the parent combined-suite total is pending
confirmation; do not repeat the obsolete 43-test count or claim 99 until the
parent run confirms it.