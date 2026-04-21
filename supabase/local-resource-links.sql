CREATE TABLE IF NOT EXISTS local_resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  show_title_on_card boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  website_label text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  phone_label text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  email_label text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  county_area text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  legacy_firestore_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT local_resource_links_has_contact
    CHECK (website <> '' OR phone <> '' OR email <> '')
);

CREATE INDEX IF NOT EXISTS idx_local_resource_links_category
  ON local_resource_links (category);

CREATE INDEX IF NOT EXISTS idx_local_resource_links_active
  ON local_resource_links (is_active);

CREATE OR REPLACE FUNCTION set_local_resource_link_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_local_resource_links_audit ON local_resource_links;
CREATE TRIGGER trg_local_resource_links_audit
  BEFORE INSERT OR UPDATE ON local_resource_links
  FOR EACH ROW EXECUTE FUNCTION set_local_resource_link_audit_fields();

ALTER TABLE local_resource_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "local_resource_links_select_authenticated" ON local_resource_links;
DROP POLICY IF EXISTS "local_resource_links_insert_admin" ON local_resource_links;
DROP POLICY IF EXISTS "local_resource_links_update_admin" ON local_resource_links;
DROP POLICY IF EXISTS "local_resource_links_delete_admin" ON local_resource_links;

CREATE POLICY "local_resource_links_select_authenticated"
  ON local_resource_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "local_resource_links_insert_admin"
  ON local_resource_links FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "local_resource_links_update_admin"
  ON local_resource_links FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "local_resource_links_delete_admin"
  ON local_resource_links FOR DELETE
  TO authenticated
  USING (is_admin());
