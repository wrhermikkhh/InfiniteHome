# Legacy inventory: disposable race acceptance and historical review

These tools do not enable RedotPay, deploy, migrate a database, or contact a
payment provider. Neither imports the application's database configuration.
Never run acceptance tests on a store database.

## Real PostgreSQL race acceptance

Provision a **new empty local PostgreSQL database** named
`inventory_disposable_test`, with a dedicated local user `inventory_test`.
Use a disposable local PostgreSQL instance with loopback-only connectivity and
local trust authentication for that dedicated test user. No passwords are
accepted by this harness. Do not tunnel a remote/store database to localhost.

From the project root, with dependencies already installed:

```sh
env -i PATH="$PATH" HOME="$HOME" npx tsx \
  script/legacy-inventory-postgres-acceptance.ts \
  --disposable-local-only \
  --database-url postgresql://inventory_test@127.0.0.1:5432/inventory_disposable_test
```

The harness refuses application/provider/PG environment variables, non-loopback
URLs, passwords, URL options, database names without the disposable prefix,
servers reporting a non-loopback address, and databases with any user tables or
views. It creates a uniquely named schema, executes actual SQL and the shared
inventory helpers, then drops only that schema. A process kill may leave the
schema behind; discard the entire disposable database and provision a fresh one
rather than bypassing the empty-database check.

Both node-postgres and postgres-js run the same assertions. The harness observes
`pg_stat_activity.wait_event_type = 'Lock'` while deliberately holding the
winning transaction; this is not a timing-only concurrency mock. Assertions
cover legacy/COD winning against a RedotPay-style reservation, the reverse race
against POS, multi-product, insert-failure and partial-restore rollback, duplicate concurrent
cancellation, restoration racing provider reservation, POS ownership transfer,
provider closure/repeated release against bank checkout, variant/preorder
reservation races, reversed multi-product cart order, and preorder aggregate
cap/variant rollback and restore. It uses real driver
result shapes. It does not execute HTTP checkout routes or a provider request:
the RedotPay contender reproduces its `ORDER BY id FOR UPDATE`, stock updates,
and payment-row/terminal-state release protocol. Full provider/webhook/Vercel
acceptance remains a separate gate.

The tool has not been run against the workspace/store database. An isolated
PostgreSQL 16.10 cluster was provisioned under `/tmp` with a clean environment,
loopback-only port 55439, a dedicated `inventory_test` user, and an empty
`inventory_disposable_test` database. Both drivers passed all real locking,
rollback, restore, transfer and preorder assertions. The initial server-address
check was corrected to use `host(inet_server_addr())`, since an inet-to-text
cast includes the network mask.

In that same disposable database, after the harness removed its schema, the
reviewed migration was applied twice with minimal `admins`/`orders` prerequisite
tables and `anon`/`authenticated` roles. Assertions confirmed preserved fixture
data, schema markers 1 and 2, RLS on all seven protected tables, no browser-role
table privileges, immutable payment amount/reservation-key enforcement, and an
allowed payment-state transition. The cluster was stopped and its directory
deleted afterward. This validates fresh-install/repeated-apply behavior, not a
production-schema upgrade or live-provider/Vercel acceptance.

## Historical allocation reconciliation

Old order/POS records cannot prove which stock was actually deducted. Previous
development/production implementations differed, and partial failures were
possible. **Never infer historical allocations from current stock or blindly
backfill every order item.** This tool only inserts an explicit reviewed ledger;
it never deducts/restores stock, changes an order status, or modifies existing
ledger entries.

Prerequisite: the reviewed `legacy_inventory_reservations` migration must
already be present. The operator must provide an appropriately restricted
database connection through **INVENTORY_RECONCILIATION_URL**, independently of
the application's environment, using their secret manager. There is no
`DATABASE_URL` fallback. Do not place credentials in command history or evidence
files. Use read-only credentials for inspect/dry-run where possible. An apply
connection requires SELECT on orders/POS/products, row-lock permissions on
owners, and INSERT on the ledger; it does not need product UPDATE permissions.

1. Inspect each historical owner using a read-only transaction:

   ```sh
   npx tsx script/legacy-inventory-reconcile.ts --inspect order:ORDER_ID
   npx tsx script/legacy-inventory-reconcile.ts --inspect pos:POS_ID
   ```

   Save the returned inventory-only snapshot and `snapshotSha256` with the
   operator's evidence. Snapshots omit customer contact details and pricing.
   Already-converted POS must be reconciled on its order, never both owners.
   RedotPay orders are explicitly refused; use provider recovery for those.

2. Obtain evidence of the **actual original deduction and any restoration**:
   database audit/transaction records, verified inventory movement records, or
   other independently reviewed records. If evidence is ambiguous, stop and
   investigate. A stock recount/adjustment is a separate approved process, not
   something this script guesses or silently performs.

3. Prepare and independently review a JSON plan:

   ```json
   {
     "version": 1,
     "target": { "hostname": "reviewed-database-host", "database": "reviewed_database" },
     "reviewedBy": "operator-change-record-identity",
     "reviewedAt": "2026-01-01T12:00:00.000Z",
     "entries": [{
       "ownerType": "order",
       "ownerId": "ACTUAL_ORDER_ID",
       "snapshotSha256": "COPY_THE_64_CHARACTER_INSPECTION_HASH",
       "evidenceReference": "restricted-change-record/evidence-id",
       "explanation": "Describe evidence proving the exact historical stock movement.",
       "disposition": "outstanding",
       "allocations": [{
         "productId": "ACTUAL_PRODUCT_ID",
         "qty": 2,
         "key": "S-Blue",
         "preorder": false,
         "capped": false
       }]
     }]
   }
   ```

   Replace all illustrative values; this is a format example, not executable
   evidence. Regular stock uses `key: null, capped: true` for general stock or
   the exact historically deducted variant key with `capped: false`. Preorders
   use `preorder: true`; `capped` records whether the original total cap was
   decremented, independently of a nullable variant `key`. Quantity is the
   amount actually deducted, not necessarily the ordered quantity. An explicit
   `allocations: []` is allowed **only with reviewed evidence proving no stock
   deduction**, so cancellation may safely leave inventory unchanged.

   For an already-cancelled/refunded owner with proven completed restoration,
   use `disposition: "already_restored"` and an evidenced ISO `restoredAt`.
   This records history without restoring again. Cancelled owners with uncertain
   restoration require investigation, not a fabricated timestamp.

4. Validate structure offline, then perform a read-only database dry-run:

   ```sh
   npx tsx script/legacy-inventory-reconcile.ts --validate-plan reviewed-plan.json
   npx tsx script/legacy-inventory-reconcile.ts --plan reviewed-plan.json
   ```

   The database dry-run verifies the reviewed target, current owner snapshot,
   status/disposition, absence of a ledger, product membership/quantity limits,
   and ability to restore the recorded variant/cap. It does not write anything.
   Capture its canonical `planSha256` and review all output.

5. Only after explicit operator/change approval, run:

   ```sh
   npx tsx script/legacy-inventory-reconcile.ts --plan reviewed-plan.json \
     --apply --approve-sha256 APPROVED_PLAN_HASH \
     --confirm-database REVIEWED_DATABASE_NAME
   ```

   All owners are rechecked under row locks in one serializable transaction.
   A changed snapshot, duplicate ledger, race, missing product/variant or any
   error aborts the entire plan. No evidence is overwritten. Preserve the exact
   reviewed plan and committed output in an access-controlled change record:
   the existing ledger schema has no reviewer/audit columns, so these external
   records are required. Approval flags are an intentional operator safety
   barrier, not a cryptographic proof of independent reviewer identity.

After an outstanding ledger is backfilled, ordinary authenticated cancellation
can restore exactly that allocation once. Historical POS conversion transfers
the reviewed ledger to the resulting order without another stock deduction.
Do not rerun an already-applied plan: the existing-ledger guard deliberately
refuses it. Inspect and review afresh after any conflict.