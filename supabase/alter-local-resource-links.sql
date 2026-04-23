ALTER TABLE local_resource_links
  ADD COLUMN IF NOT EXISTS show_title_on_card boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS website_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS county_area text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legacy_firestore_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_local_resource_links_legacy_firestore_id
  ON local_resource_links (legacy_firestore_id)
  WHERE legacy_firestore_id IS NOT NULL;

ALTER TABLE local_resource_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_resource_links'
      AND policyname = 'local_resource_links_select_authenticated'
  ) THEN
    CREATE POLICY "local_resource_links_select_authenticated"
      ON local_resource_links FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_resource_links'
      AND policyname = 'local_resource_links_insert_admin'
  ) THEN
    CREATE POLICY "local_resource_links_insert_admin"
      ON local_resource_links FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_resource_links'
      AND policyname = 'local_resource_links_update_admin'
  ) THEN
    CREATE POLICY "local_resource_links_update_admin"
      ON local_resource_links FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_resource_links'
      AND policyname = 'local_resource_links_delete_admin'
  ) THEN
    CREATE POLICY "local_resource_links_delete_admin"
      ON local_resource_links FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
