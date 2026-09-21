---
name: RedotPay activation safety
description: Why configured merchant credentials do not mean RedotPay is cleared for live use.
---

Do not treat merchant credential setup, local tests, or successful mocked
payments as permission to activate RedotPay.

**Why:** The implementation adds server-side authorization, atomic inventory
handling, throttling, recovery controls, and provider verification, but local
signature tests and isolated SQL concurrency tests cannot prove the merchant
account, Vercel transport behavior, deployed database behavior, or live
notification delivery. The user authorized safety implementation, not a
production migration, deployment, real payment, or live activation. Production
merchant credentials are not sandbox credentials.

**How to apply:** Keep both live gates disabled until the migration, isolated
Vercel acceptance, provider sandbox acceptance, and production rollout are
separately approved and evidenced. Use MVR 15.42 per USD and the confirmed
canonical production origin `https://infinite-home.vercel.app`; neither value is
evidence that deployment or acceptance occurred.

The Vercel entrypoint delegates to the shared server routes and storage; do not
maintain a second backend. The release prerequisites are, in order,
`admin-security-migration.sql`, `redotpay-migration.sql` schema v2, then
`inventory-safety-migration.sql`. Admin auth has one session authority in
`shared/admin-auth.ts`; old MD5-era sessions require re-login.

Historical inventory recovery must use reviewed allocation evidence, not
reconstruct deductions from current stock or order lines alone.

**Why:** Earlier development and Vercel paths deducted stock differently, so
historical order records do not reliably prove which stock buckets were
deducted. Guessing during cancellation can inflate inventory.

**How to apply:** Require explicit reviewed historical allocation records before
restoring old orders or transferring old POS allocations. Keep uncertain records
blocked and explain the operational impact before rollout. If an earlier
deployment contains `inventory_sales`, treat it as evidence requiring reviewed
reconciliation; never silently migrate it into the canonical
`legacy_inventory_reservations` ledger.

Distinguish private-key validity from errors introduced while copying it into
secure storage. Do not rotate merchant keys solely because an imported copy
cannot be parsed.

**Why:** A locally validated sandbox key repeatedly arrived malformed through
manual terminal selection; direct clipboard transfer of an encoded copy
preserved the existing RSA pair and allowed a signed sandbox lookup.

**How to apply:** Validate locally without printing private material, use secure
input for transfer, and confirm decoding/parsing before making provider calls.
Never treat a successful lookup as full payment or webhook acceptance.