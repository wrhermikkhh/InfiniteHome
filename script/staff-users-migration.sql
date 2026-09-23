-- Apply to each app database before deploying staff record routes.
-- Staff records have no password, login, or administrator permissions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending_access',
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_ci_unique
  ON public.staff_users (lower(email));

-- Admin sign-in/reset already match email without case sensitivity.
CREATE UNIQUE INDEX IF NOT EXISTS admins_email_ci_unique
  ON public.admins (lower(email));

-- Only the server's trusted database connection may read staff identities.
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_users FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.staff_users FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.staff_users FROM authenticated;
  END IF;
END $$;

COMMIT;