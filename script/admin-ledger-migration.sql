-- Additive, server-only accounting and inventory ledger.
-- This migration deliberately does not backfill or alter existing product,
-- order, POS, or admin rows. Apply it to an isolated database first and
-- review the target database before applying it to production.
-- Environment difference: the live Supabase pos_transactions.id is uuid,
-- while the development database uses varchar. For that live target only,
-- change the two pos_id declarations referencing pos_transactions(id) below
-- from varchar to uuid before applying. All other statements stay the same.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

-- Additive retry idempotency fields; safe to rerun after the initial ledger.
ALTER TABLE IF EXISTS pos_accounting
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE IF EXISTS manual_order_accounting
  ADD COLUMN IF NOT EXISTS fx_variance_mvr numeric(14,4) NOT NULL DEFAULT 0;

-- Exchange rates are snapshots: existing sales remain NULL and are never
-- rewritten. New orders and POS transactions get the current setting at
-- insert time unless the caller supplies an explicit snapshot.
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS usd_to_mvr_rate numeric(14,6);
ALTER TABLE IF EXISTS pos_transactions
  ADD COLUMN IF NOT EXISTS usd_to_mvr_rate numeric(14,6);

-- RedotPay payment rates must preserve the same six-decimal snapshot
-- precision as orders and POS transactions. This is a widening-only change;
-- skip it when the separately-managed RedotPay table is not installed.
DO $$
BEGIN
  IF to_regclass('public.redotpay_payments') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'redotpay_payments'
         AND column_name = 'rate'
     ) THEN
    ALTER TABLE public.redotpay_payments
      ALTER COLUMN rate TYPE numeric(14,6)
      USING rate::numeric(14,6);
  END IF;
END $$;

-- A pre-existing object is only safe to reuse when it was created by this
-- migration version and still has the columns plus a key constraint expected
-- by the application.  Unmarked/colliding objects fail closed.
DO $$
DECLARE
  target_table text;
  expected_columns text[];
  expected_column text;
  relation_oid oid;
  marker text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'admin_product_details', 'product_variant_commercial', 'suppliers',
    'inventory_batches', 'inventory_movements', 'sale_cogs_lines',
    'accounting_settings', 'pos_payment_lines', 'pos_accounting',
    'manual_order_accounting', 'manual_order_payment_lines',
    'expenses', 'accounting_audit'
  ] LOOP
    relation_oid := to_regclass(format('public.%I', target_table));
    IF relation_oid IS NULL THEN CONTINUE; END IF;
    marker := 'Infinite Home admin ledger v1:' || target_table;
    IF obj_description(relation_oid, 'pg_class') IS DISTINCT FROM marker THEN
      RAISE EXCEPTION 'Refusing to reuse marked public.%: missing expected comment marker %', target_table, marker;
    END IF;
    expected_columns := CASE target_table
      WHEN 'admin_product_details' THEN ARRAY['product_id','weight_kg','length_cm','width_cm','height_cm','wholesale_cost_mvr','supplier_cost_mvr']
      WHEN 'product_variant_commercial' THEN ARRAY['product_id','variant_key','sku','usd_price','wholesale_cost_mvr','supplier_cost_mvr']
      WHEN 'suppliers' THEN ARRAY['id','name','contact']
      WHEN 'inventory_batches' THEN ARRAY['id','product_id','variant_key','supplier_id','arrived_at','quantity_received','quantity_remaining','supplier_cost','cost_currency','exchange_rate','unit_landed_cost_mvr','reference','receipt_key','created_by']
      WHEN 'inventory_movements' THEN ARRAY['id','product_id','variant_key','quantity_delta','quantity_before','quantity_after','kind','reason','batch_id','reference','actor_id','created_at']
      WHEN 'sale_cogs_lines' THEN ARRAY['id','sale_kind','sale_id','line_index','batch_id','quantity','unit_cost_mvr','total_cost_mvr','confidence','reversed_at','created_at']
      WHEN 'accounting_settings' THEN ARRAY['id','tax_enabled','gst_rate','tgst_rate','usd_to_mvr_rate','costing_method','updated_by','updated_at']
      WHEN 'pos_payment_lines' THEN ARRAY['id','pos_id','method','currency','amount','usd_to_mvr_rate','amount_mvr','fee_mvr','reference','created_at']
       WHEN 'pos_accounting' THEN ARRAY['pos_id','idempotency_key','request_hash','tax_type','taxable_base_mvr','tax_rate','tax_amount_mvr','fx_variance_mvr','recorded_at']
      WHEN 'manual_order_accounting' THEN ARRAY['order_id','idempotency_key','request_hash','created_by','tax_type','taxable_base_mvr','tax_rate','tax_amount_mvr','fee_mvr','fx_variance_mvr','status_snapshot','recorded_at']
      WHEN 'manual_order_payment_lines' THEN ARRAY['id','order_id','method','currency','amount','usd_to_mvr_rate','amount_mvr','fee_mvr','reference','created_at']
      WHEN 'expenses' THEN ARRAY['id','category','description','amount','currency','usd_to_mvr_rate','amount_mvr','is_landed','batch_id','supplier_id','expense_date','actor_id','created_at']
      WHEN 'accounting_audit' THEN ARRAY['id','actor_id','entity_kind','entity_id','action','reason','data','created_at']
    END;
    FOREACH expected_column IN ARRAY expected_columns LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = target_table AND c.column_name = expected_column
      ) THEN
        RAISE EXCEPTION 'Refusing to reuse marked public.%: missing expected column %', target_table, expected_column;
      END IF;
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = relation_oid AND contype IN ('p', 'u', 'f', 'c')
    ) THEN
      RAISE EXCEPTION 'Refusing to reuse marked public.%: no expected key/reference/check constraint', target_table;
    END IF;
  END LOOP;
END $$;

-- Index names are also part of the migration's public safety boundary.  A
-- same-named index on another table (or with different uniqueness/predicate
-- semantics) must never be adopted by IF NOT EXISTS.
DO $$
DECLARE
  index_name text;
  parent_table text;
  expected_unique boolean;
  expected_predicate text;
  expected_keys text[];
  index_oid oid;
  actual_predicate text;
  index_position integer;
  index_names text[] := ARRAY[
    'inventory_batches_product_arrived_idx',
    'inventory_movements_product_created_idx',
    'sale_cogs_lines_sale_idx',
    'sale_cogs_lines_sale_line_batch_nonnull_unique',
    'sale_cogs_lines_sale_line_batch_null_unique',
    'pos_payment_lines_pos_idx',
    'expenses_date_idx',
    'accounting_audit_entity_idx',
    'pos_accounting_idempotency_key_idx',
    'manual_order_accounting_idempotency_key_idx'
  ];
  parent_tables text[] := ARRAY[
    'inventory_batches', 'inventory_movements', 'sale_cogs_lines',
    'sale_cogs_lines', 'sale_cogs_lines', 'pos_payment_lines',
    'expenses', 'accounting_audit', 'pos_accounting',
    'manual_order_accounting'
  ];
  unique_flags boolean[] := ARRAY[false, false, false, true, true, false, false, false, true, true];
  predicates text[] := ARRAY[
    NULL::text, NULL::text, NULL::text, 'batch_id IS NOT NULL',
    'batch_id IS NULL', NULL::text, NULL::text, NULL::text,
    'idempotency_key IS NOT NULL', 'idempotency_key IS NOT NULL'
  ];
  key_columns text[] := ARRAY[
    'product_id,variant_key,arrived_at,id',
    'product_id,variant_key,created_at',
    'sale_kind,sale_id,line_index',
    'sale_kind,sale_id,line_index,batch_id',
    'sale_kind,sale_id,line_index',
    'pos_id,created_at',
    'expense_date',
    'entity_kind,entity_id,created_at', 'idempotency_key', 'idempotency_key'
  ];
BEGIN
  FOR index_position IN 1..array_length(index_names, 1) LOOP
    index_name := index_names[index_position];
    parent_table := parent_tables[index_position];
    expected_unique := unique_flags[index_position];
    expected_predicate := predicates[index_position];
    expected_keys := string_to_array(key_columns[index_position], ',');
    index_oid := to_regclass(format('public.%I', index_name));
    IF index_oid IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class idx
      JOIN pg_namespace ns ON ns.oid = idx.relnamespace
      WHERE idx.oid = index_oid AND idx.relkind = 'i' AND ns.nspname = 'public'
    ) THEN
      RAISE EXCEPTION 'Refusing to reuse public.%: object is not a public index', index_name;
    END IF;
    IF obj_description(index_oid, 'pg_class') IS DISTINCT FROM
      'Infinite Home admin ledger v1:index:' || index_name THEN
      RAISE EXCEPTION 'Refusing to reuse public.%: missing expected project index marker', index_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class parent ON parent.oid = i.indrelid
      JOIN pg_namespace pns ON pns.oid = parent.relnamespace
      WHERE i.indexrelid = index_oid
        AND pns.nspname = 'public'
        AND parent.relname = parent_table
        AND i.indisunique = expected_unique
    ) THEN
      RAISE EXCEPTION 'Refusing to reuse public.%: parent or uniqueness definition differs', index_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS key_columns(attnum, ordinal)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = key_columns.attnum
      WHERE i.indexrelid = index_oid
      GROUP BY i.indexrelid
       HAVING array_agg(a.attname::text ORDER BY key_columns.ordinal) = expected_keys
    ) THEN
      RAISE EXCEPTION 'Refusing to reuse public.%: indexed columns differ', index_name;
    END IF;
    SELECT pg_get_expr(i.indpred, i.indrelid)
      INTO actual_predicate
      FROM pg_index i
      WHERE i.indexrelid = index_oid;
    IF regexp_replace(coalesce(actual_predicate, ''), '[()[:space:]]', '', 'g')
       IS DISTINCT FROM regexp_replace(coalesce(expected_predicate, ''), '[()[:space:]]', '', 'g') THEN
      RAISE EXCEPTION 'Refusing to reuse public.%: partial-index predicate differs', index_name;
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS admin_product_details (
  product_id varchar PRIMARY KEY REFERENCES products(id),
  weight_kg numeric(14,6),
  length_cm numeric(14,4),
  width_cm numeric(14,4),
  height_cm numeric(14,4),
  wholesale_cost_mvr numeric(14,4),
  supplier_cost_mvr numeric(14,4),
  CONSTRAINT admin_product_details_nonnegative_check CHECK (
    (weight_kg IS NULL OR weight_kg >= 0)
    AND (length_cm IS NULL OR length_cm >= 0)
    AND (width_cm IS NULL OR width_cm >= 0)
    AND (height_cm IS NULL OR height_cm >= 0)
    AND (wholesale_cost_mvr IS NULL OR wholesale_cost_mvr >= 0)
    AND (supplier_cost_mvr IS NULL OR supplier_cost_mvr >= 0)
  )
);

CREATE TABLE IF NOT EXISTS product_variant_commercial (
  product_id varchar NOT NULL REFERENCES products(id),
  variant_key text NOT NULL,
  sku text UNIQUE,
  usd_price numeric(14,4),
  wholesale_cost_mvr numeric(14,4),
  supplier_cost_mvr numeric(14,4),
  PRIMARY KEY (product_id, variant_key),
  CONSTRAINT product_variant_commercial_nonnegative_check CHECK (
    (usd_price IS NULL OR usd_price >= 0)
    AND (wholesale_cost_mvr IS NULL OR wholesale_cost_mvr >= 0)
    AND (supplier_cost_mvr IS NULL OR supplier_cost_mvr >= 0)
  )
);

CREATE TABLE IF NOT EXISTS suppliers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact text
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id varchar NOT NULL REFERENCES products(id),
  variant_key text,
  supplier_id varchar REFERENCES suppliers(id),
  arrived_at timestamptz NOT NULL DEFAULT now(),
  quantity_received numeric(14,4) NOT NULL,
  quantity_remaining numeric(14,4) NOT NULL,
  supplier_cost numeric(14,6) NOT NULL,
  cost_currency text NOT NULL DEFAULT 'MVR',
  exchange_rate numeric(14,6),
  unit_landed_cost_mvr numeric(14,6) NOT NULL,
  reference text,
  receipt_key text NOT NULL UNIQUE,
  created_by varchar NOT NULL REFERENCES admins(id),
  CONSTRAINT inventory_batches_quantity_check CHECK (
    quantity_received > 0 AND quantity_remaining >= 0
    AND quantity_remaining <= quantity_received
  ),
  CONSTRAINT inventory_batches_currency_check CHECK (cost_currency IN ('MVR', 'USD')),
  CONSTRAINT inventory_batches_cost_check CHECK (
    supplier_cost >= 0 AND unit_landed_cost_mvr >= 0
    AND (cost_currency = 'MVR' OR exchange_rate IS NOT NULL AND exchange_rate > 0)
  )
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id varchar NOT NULL REFERENCES products(id),
  variant_key text,
  quantity_delta numeric(14,4) NOT NULL,
  quantity_before numeric(14,4) NOT NULL,
  quantity_after numeric(14,4) NOT NULL,
  kind text NOT NULL,
  reason text NOT NULL,
  batch_id varchar REFERENCES inventory_batches(id),
  reference text,
  actor_id varchar NOT NULL REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_balance_check CHECK (
    quantity_before >= 0 AND quantity_after >= 0
    AND quantity_delta = quantity_after - quantity_before
  )
);

CREATE TABLE IF NOT EXISTS sale_cogs_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_kind text NOT NULL CHECK (sale_kind IN ('POS', 'ORDER')),
  sale_id varchar NOT NULL,
  line_index integer NOT NULL,
  batch_id varchar REFERENCES inventory_batches(id),
  quantity numeric(14,4) NOT NULL,
  unit_cost_mvr numeric(14,6) NOT NULL,
  total_cost_mvr numeric(14,6) NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('known', 'estimated', 'historical_unknown')),
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_cogs_lines_quantity_check CHECK (
    quantity > 0 AND unit_cost_mvr >= 0 AND total_cost_mvr >= 0
  )
);

CREATE TABLE IF NOT EXISTS accounting_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tax_enabled boolean NOT NULL DEFAULT false,
  gst_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (gst_rate >= 0),
  tgst_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tgst_rate >= 0),
  usd_to_mvr_rate numeric(14,6) NOT NULL DEFAULT 15.42 CHECK (usd_to_mvr_rate > 0),
  costing_method text NOT NULL DEFAULT 'FIFO' CHECK (costing_method IN ('FIFO', 'AVERAGE')),
  updated_by varchar REFERENCES admins(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The default applies to newly-created settings rows. Preserve any existing
-- custom rate, while making a legacy NULL singleton use the new default.
ALTER TABLE accounting_settings
  ALTER COLUMN usd_to_mvr_rate SET DEFAULT 15.42;
UPDATE accounting_settings
SET usd_to_mvr_rate = 15.42
WHERE id = 1 AND usd_to_mvr_rate IS NULL;
-- Ensure the singleton exists before any writer reads it under FOR SHARE.
-- A conflict is deliberately ignored so an existing custom rate wins.
INSERT INTO accounting_settings (id, usd_to_mvr_rate)
VALUES (1, 15.42)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE accounting_settings
  ALTER COLUMN usd_to_mvr_rate SET NOT NULL;

-- Snapshot the rate once, at sale creation. A trigger is used so all insert
-- paths (including direct SQL) receive the same protection. It only fills a
-- missing snapshot and never updates existing rows.
CREATE OR REPLACE FUNCTION public.snapshot_usd_to_mvr_rate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.usd_to_mvr_rate IS NULL THEN
    NEW.usd_to_mvr_rate := COALESCE(
      (SELECT s.usd_to_mvr_rate FROM public.accounting_settings AS s WHERE s.id = 1),
      15.42
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER infinite_home_orders_snapshot_usd_to_mvr_rate
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_usd_to_mvr_rate();

CREATE OR REPLACE TRIGGER infinite_home_pos_transactions_snapshot_usd_to_mvr_rate
  BEFORE INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_usd_to_mvr_rate();

CREATE TABLE IF NOT EXISTS pos_payment_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id varchar NOT NULL REFERENCES pos_transactions(id),
  method text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('MVR', 'USD')),
  amount numeric(14,4) NOT NULL,
  usd_to_mvr_rate numeric(14,6),
  amount_mvr numeric(14,4) NOT NULL,
  fee_mvr numeric(14,4) NOT NULL DEFAULT 0,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_payment_lines_amount_check CHECK (amount > 0 AND amount_mvr > 0 AND fee_mvr >= 0),
  CONSTRAINT pos_payment_lines_rate_check CHECK (
    currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0
  )
);

CREATE TABLE IF NOT EXISTS pos_accounting (
  pos_id varchar PRIMARY KEY REFERENCES pos_transactions(id),
  idempotency_key text,
  request_hash text,
  tax_type text NOT NULL DEFAULT 'NONE' CHECK (tax_type IN ('NONE', 'GST', 'TGST')),
  taxable_base_mvr numeric(14,4) NOT NULL DEFAULT 0 CHECK (taxable_base_mvr >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount_mvr numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_amount_mvr >= 0),
  fx_variance_mvr numeric(14,4) NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_order_accounting (
  order_id varchar PRIMARY KEY REFERENCES orders(id),
  idempotency_key text,
  request_hash text,
  created_by varchar NOT NULL REFERENCES admins(id),
  tax_type text NOT NULL DEFAULT 'NONE' CHECK (tax_type IN ('NONE', 'GST', 'TGST')),
  taxable_base_mvr numeric(14,4) NOT NULL DEFAULT 0 CHECK (taxable_base_mvr >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount_mvr numeric(14,4) NOT NULL DEFAULT 0 CHECK (tax_amount_mvr >= 0),
  fee_mvr numeric(14,4) NOT NULL DEFAULT 0 CHECK (fee_mvr >= 0),
  fx_variance_mvr numeric(14,4) NOT NULL DEFAULT 0,
  status_snapshot text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_order_payment_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id),
  method text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('MVR', 'USD')),
  amount numeric(14,4) NOT NULL,
  usd_to_mvr_rate numeric(14,6),
  amount_mvr numeric(14,4) NOT NULL,
  fee_mvr numeric(14,4) NOT NULL DEFAULT 0,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_order_payment_lines_amount_check CHECK (
    amount > 0 AND amount_mvr > 0 AND fee_mvr >= 0
  ),
  CONSTRAINT manual_order_payment_lines_rate_check CHECK (
    currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS manual_order_accounting_idempotency_key_idx
  ON manual_order_accounting (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS expenses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(14,4) NOT NULL,
  currency text NOT NULL CHECK (currency IN ('MVR', 'USD')),
  usd_to_mvr_rate numeric(14,6),
  amount_mvr numeric(14,4) NOT NULL,
  is_landed boolean NOT NULL DEFAULT false,
  batch_id varchar REFERENCES inventory_batches(id),
  supplier_id varchar REFERENCES suppliers(id),
  expense_date timestamptz NOT NULL,
  actor_id varchar NOT NULL REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_amount_check CHECK (amount > 0 AND amount_mvr > 0),
  CONSTRAINT expenses_rate_check CHECK (currency = 'MVR' OR usd_to_mvr_rate IS NOT NULL AND usd_to_mvr_rate > 0),
  CONSTRAINT expenses_landed_link_check CHECK (NOT is_landed OR batch_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS accounting_audit (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar NOT NULL REFERENCES admins(id),
  entity_kind text NOT NULL,
  entity_id varchar NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_batches_product_arrived_idx ON inventory_batches (product_id, variant_key, arrived_at, id);
CREATE INDEX IF NOT EXISTS inventory_movements_product_created_idx ON inventory_movements (product_id, variant_key, created_at DESC);
CREATE INDEX IF NOT EXISTS sale_cogs_lines_sale_idx ON sale_cogs_lines (sale_kind, sale_id, line_index);
CREATE UNIQUE INDEX IF NOT EXISTS sale_cogs_lines_sale_line_batch_nonnull_unique
  ON sale_cogs_lines (sale_kind, sale_id, line_index, batch_id)
  WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sale_cogs_lines_sale_line_batch_null_unique
  ON sale_cogs_lines (sale_kind, sale_id, line_index)
  WHERE batch_id IS NULL;
CREATE INDEX IF NOT EXISTS pos_payment_lines_pos_idx ON pos_payment_lines (pos_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS pos_accounting_idempotency_key_idx
  ON pos_accounting (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS accounting_audit_entity_idx ON accounting_audit (entity_kind, entity_id, created_at DESC);

-- These tables are intentionally server-only. The application server uses the
-- owner/BYPASSRLS role; browser roles must not read or mutate accounting data.
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['public', 'anon', 'authenticated'] LOOP
    IF browser_role = 'public' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE admin_product_details, product_variant_commercial, suppliers, inventory_batches, inventory_movements, sale_cogs_lines, accounting_settings, pos_payment_lines, pos_accounting, manual_order_accounting, manual_order_payment_lines, expenses, accounting_audit FROM %I', browser_role);
    END IF;
  END LOOP;
END $$;

ALTER TABLE admin_product_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_commercial ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_cogs_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_payment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_order_accounting ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_order_payment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_audit ENABLE ROW LEVEL SECURITY;

COMMENT ON INDEX inventory_batches_product_arrived_idx IS 'Infinite Home admin ledger v1:index:inventory_batches_product_arrived_idx';
COMMENT ON INDEX inventory_movements_product_created_idx IS 'Infinite Home admin ledger v1:index:inventory_movements_product_created_idx';
COMMENT ON INDEX sale_cogs_lines_sale_idx IS 'Infinite Home admin ledger v1:index:sale_cogs_lines_sale_idx';
COMMENT ON INDEX sale_cogs_lines_sale_line_batch_nonnull_unique IS 'Infinite Home admin ledger v1:index:sale_cogs_lines_sale_line_batch_nonnull_unique';
COMMENT ON INDEX sale_cogs_lines_sale_line_batch_null_unique IS 'Infinite Home admin ledger v1:index:sale_cogs_lines_sale_line_batch_null_unique';
COMMENT ON INDEX pos_payment_lines_pos_idx IS 'Infinite Home admin ledger v1:index:pos_payment_lines_pos_idx';
COMMENT ON INDEX pos_accounting_idempotency_key_idx IS 'Infinite Home admin ledger v1:index:pos_accounting_idempotency_key_idx';
COMMENT ON INDEX expenses_date_idx IS 'Infinite Home admin ledger v1:index:expenses_date_idx';
COMMENT ON INDEX accounting_audit_entity_idx IS 'Infinite Home admin ledger v1:index:accounting_audit_entity_idx';
COMMENT ON INDEX manual_order_accounting_idempotency_key_idx IS 'Infinite Home admin ledger v1:index:manual_order_accounting_idempotency_key_idx';

COMMENT ON TABLE admin_product_details IS 'Infinite Home admin ledger v1:admin_product_details';
COMMENT ON TABLE product_variant_commercial IS 'Infinite Home admin ledger v1:product_variant_commercial';
COMMENT ON TABLE suppliers IS 'Infinite Home admin ledger v1:suppliers';
COMMENT ON TABLE inventory_batches IS 'Infinite Home admin ledger v1:inventory_batches';
COMMENT ON TABLE inventory_movements IS 'Infinite Home admin ledger v1:inventory_movements';
COMMENT ON TABLE sale_cogs_lines IS 'Infinite Home admin ledger v1:sale_cogs_lines';
COMMENT ON TABLE accounting_settings IS 'Infinite Home admin ledger v1:accounting_settings';
COMMENT ON TABLE pos_payment_lines IS 'Infinite Home admin ledger v1:pos_payment_lines';
COMMENT ON TABLE pos_accounting IS 'Infinite Home admin ledger v1:pos_accounting';
COMMENT ON TABLE manual_order_accounting IS 'Infinite Home admin ledger v1:manual_order_accounting';
COMMENT ON TABLE manual_order_payment_lines IS 'Infinite Home admin ledger v1:manual_order_payment_lines';
COMMENT ON TABLE expenses IS 'Infinite Home admin ledger v1:expenses';
COMMENT ON TABLE accounting_audit IS 'Infinite Home admin ledger v1:accounting_audit';

COMMIT;