-- REVIEW ONLY: run manually in Supabase SQL Editor after backup and release approval.
-- This revision IS required for admin sessions and new COD/bank/POS writes.
-- Historical orders need reviewed allocation evidence; see inventory recovery guide.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id varchar NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.admin_auth_throttle (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.legacy_inventory_reservations (
  owner_type text NOT NULL CHECK (owner_type IN ('order','pos')),
  owner_id text NOT NULL,
  allocations jsonb NOT NULL CHECK (jsonb_typeof(allocations) = 'array'),
  restored_at timestamptz,
  PRIMARY KEY(owner_type, owner_id)
);
CREATE TABLE IF NOT EXISTS public.redotpay_schema (
  version integer PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS public.redotpay_payments (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  order_id varchar NOT NULL UNIQUE REFERENCES public.orders(id),
  usd_cents integer NOT NULL CHECK (usd_cents > 0),
  state text NOT NULL CHECK (state IN ('creating','unknown','pending','failed','paid','closed')),
  provider_id text UNIQUE,
  checkout_url text,
  payload jsonb NOT NULL,
  allocations jsonb NOT NULL,
  rate numeric(14,6) NOT NULL DEFAULT 15.42,
  reservation_key text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.redotpay_payments ADD COLUMN IF NOT EXISTS reservation_key text;
CREATE INDEX IF NOT EXISTS redotpay_reservations_idx
  ON public.redotpay_payments(reservation_key, created_at, state);
CREATE TABLE IF NOT EXISTS public.redotpay_rate_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits >= 0),
  PRIMARY KEY(bucket_key, window_start)
);
CREATE TABLE IF NOT EXISTS public.redotpay_operator_audit (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  payment_id text NOT NULL REFERENCES public.redotpay_payments(id),
  action text NOT NULL CHECK (action IN ('detail','close')),
  reason text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS redotpay_operator_audit_payment_idx
  ON public.redotpay_operator_audit(payment_id, created_at);
-- Direct browser Supabase clients must never access payment capabilities/state.
-- Existing payments were all quoted at 15.42; backfill before enforcing immutability.
ALTER TABLE public.redotpay_payments ADD COLUMN IF NOT EXISTS rate numeric(14,6) NOT NULL DEFAULT 15.42;
-- Widen legacy four-decimal rates without changing any stored value.
ALTER TABLE public.redotpay_payments
  ALTER COLUMN rate TYPE numeric(14,6)
  USING rate::numeric(14,6);
ALTER TABLE public.redotpay_payments ADD COLUMN IF NOT EXISTS owner_hash text;
ALTER TABLE public.redotpay_payments ADD COLUMN IF NOT EXISTS recovery_after timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS redotpay_recovery_due ON public.redotpay_payments(recovery_after) WHERE state NOT IN ('paid','closed');
CREATE TABLE IF NOT EXISTS public.redotpay_limits (
  key text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.request_browser_identities (
  token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL
);
ALTER TABLE public.request_browser_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_browser_identities FROM PUBLIC;
CREATE TABLE IF NOT EXISTS public.redotpay_audit (
  id bigserial PRIMARY KEY, payment_id text REFERENCES public.redotpay_payments(id),
  actor text NOT NULL, action text NOT NULL, outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.order_email_notifications (
  order_id varchar NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id, event_key)
);
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000 INCREMENT 1;
ALTER TABLE public.redotpay_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redotpay_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_email_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.redotpay_limits, public.redotpay_audit, public.order_email_notifications FROM PUBLIC;
ALTER TABLE public.redotpay_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redotpay_schema ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.redotpay_payments, public.redotpay_schema FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON public.request_browser_identities, public.redotpay_limits, public.redotpay_audit, public.order_email_notifications, public.redotpay_payments, public.redotpay_schema, public.admin_sessions, public.admin_auth_throttle, public.legacy_inventory_reservations, public.redotpay_rate_limits, public.redotpay_operator_audit FROM %I', browser_role);
    END IF;
  END LOOP;
END
$$;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_auth_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redotpay_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redotpay_operator_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions, public.admin_auth_throttle,
  public.legacy_inventory_reservations, public.redotpay_rate_limits,
  public.redotpay_operator_audit FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.redotpay_immutable_expectations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.usd_cents IS DISTINCT FROM OLD.usd_cents
    OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.allocations IS DISTINCT FROM OLD.allocations
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.reservation_key IS DISTINCT FROM OLD.reservation_key THEN
    RAISE EXCEPTION 'RedotPay payment expectations are immutable';
  END IF;
  IF NEW.rate IS DISTINCT FROM OLD.rate OR NEW.owner_hash IS DISTINCT FROM OLD.owner_hash THEN
    RAISE EXCEPTION 'RedotPay rate and reservation owner are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS redotpay_immutable_expectations ON public.redotpay_payments;
CREATE TRIGGER redotpay_immutable_expectations BEFORE UPDATE ON public.redotpay_payments
  FOR EACH ROW EXECUTE FUNCTION public.redotpay_immutable_expectations();
INSERT INTO public.redotpay_schema(version) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO public.redotpay_schema(version) VALUES (2) ON CONFLICT DO NOTHING;
COMMIT;