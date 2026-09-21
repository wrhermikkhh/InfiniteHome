-- Additive, idempotent migration. Run before deploying admin-security.ts.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id varchar NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash text PRIMARY KEY,
  customer_id varchar NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  password_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx ON customer_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_auth_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL
);
-- Signup/login proves knowledge of the account password, not ownership of its
-- email address. Historical email-based order access needs a separate proof.
CREATE TABLE IF NOT EXISTS customer_email_proofs (
  customer_id varchar PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text,
  expires_at timestamptz,
  verified_at timestamptz
);

-- Server-only tables: no browser policies. The owner/BYPASSRLS server connection
-- retains access; do not FORCE RLS or revoke the dedicated server role.
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_email_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_sessions, customer_sessions, admin_auth_limits, customer_email_proofs FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON admin_sessions, customer_sessions, admin_auth_limits, customer_email_proofs FROM %I', browser_role);
    END IF;
  END LOOP;
END
$$;