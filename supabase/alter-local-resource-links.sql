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

NOTIFY pgrst, 'reload schema';
