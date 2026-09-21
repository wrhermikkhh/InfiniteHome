-- Additive prerequisite; review and apply separately before deploying inventory code.
-- No existing orders or product quantities are modified.
-- Historical sales have no trustworthy allocation record: the two former
-- runtimes differed on scalar stock and restoration could commit separately.
-- Reconcile legacy outstanding orders/POS against actual inventory before
-- inserting their allocation ledger entries. Do not blindly backfill from items.
-- Until reconciled, cancellation (and legacy POS conversion) fails explicitly.
-- Authenticated operators can record verified outstanding allocations in
-- Admin -> Inventory -> Historical inventory reconciliation. Approval is
-- immutable and audited in the columns below; it never changes product stock.
CREATE TABLE IF NOT EXISTS inventory_sales (
  kind text NOT NULL CHECK (kind IN ('order', 'pos')),
  sale_id varchar NOT NULL,
  allocations jsonb NOT NULL,
  released boolean NOT NULL DEFAULT false,
  PRIMARY KEY (kind, sale_id)
);
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS reconciled_by varchar;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS reconciliation_note text;
ALTER TABLE inventory_sales ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Allocation/reconciliation records must never be readable or writable through
-- browser Supabase credentials. Owner/BYPASSRLS server access is unchanged.
ALTER TABLE inventory_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inventory_sales FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON inventory_sales FROM %I', browser_role);
    END IF;
  END LOOP;
END
$$;