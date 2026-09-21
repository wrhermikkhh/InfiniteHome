-- Run manually in Supabase SQL Editor after backup. Never required for COD/bank.
BEGIN;
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
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Direct browser Supabase clients must never access payment capabilities/state.
ALTER TABLE public.redotpay_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redotpay_schema ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.redotpay_payments FROM anon, authenticated;
REVOKE ALL ON public.redotpay_schema FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.redotpay_immutable_expectations()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.usd_cents IS DISTINCT FROM OLD.usd_cents
    OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.allocations IS DISTINCT FROM OLD.allocations
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'RedotPay payment expectations are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS redotpay_immutable_expectations ON public.redotpay_payments;
CREATE TRIGGER redotpay_immutable_expectations BEFORE UPDATE ON public.redotpay_payments
  FOR EACH ROW EXECUTE FUNCTION public.redotpay_immutable_expectations();
INSERT INTO public.redotpay_schema(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;