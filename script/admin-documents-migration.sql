-- Additive internal document storage. Apply to the reviewed app database
-- before deploying the quotations and purchase-order API.
CREATE SEQUENCE IF NOT EXISTS admin_document_number_seq;

CREATE TABLE IF NOT EXISTS admin_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('quotation', 'purchase_order')),
  number text NOT NULL UNIQUE,
  party_name text NOT NULL,
  contact text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  due_date text,
  status text NOT NULL DEFAULT 'draft',
  items jsonb NOT NULL,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  created_by varchar NOT NULL REFERENCES admins(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT admin_documents_status_check CHECK (
    (kind = 'quotation' AND status IN ('draft', 'sent', 'accepted', 'declined'))
    OR (kind = 'purchase_order' AND status IN ('draft', 'ordered', 'received', 'cancelled'))
  )
);

-- Earlier sandbox versions of this additive table used real. Upgrade in place.
ALTER TABLE admin_documents ALTER COLUMN total TYPE numeric(12,2)
  USING round(total::numeric, 2);
ALTER TABLE admin_documents ADD COLUMN IF NOT EXISTS discount numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS admin_documents_kind_created_idx
  ON admin_documents (kind, created_at DESC);

-- Server connection uses the owner/BYPASSRLS role. Browser roles get no access.
ALTER TABLE admin_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_documents FROM PUBLIC;
REVOKE ALL ON SEQUENCE admin_document_number_seq FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON admin_documents FROM anon;
    REVOKE ALL ON SEQUENCE admin_document_number_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON admin_documents FROM authenticated;
    REVOKE ALL ON SEQUENCE admin_document_number_seq FROM authenticated;
  END IF;
END $$;