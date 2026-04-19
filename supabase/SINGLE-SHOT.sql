-- =================================================================
-- MyMedInfo: Complete Supabase Deployment (ALL-IN-ONE)
-- Copy and paste EVERYTHING below into Supabase SQL Editor
-- =================================================================

-- TABLES
CREATE TABLE IF NOT EXISTS practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_lowercase text NOT NULL,
  ods_code text,
  contact_email text,
  contact_name text,
  is_active boolean NOT NULL DEFAULT false,
  auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_medications text[] DEFAULT '{}',
  medication_review_dates jsonb DEFAULT '{}',
  link_visit_count integer NOT NULL DEFAULT 0,
  patient_rating_count integer NOT NULL DEFAULT 0,
  patient_rating_total integer NOT NULL DEFAULT 0,
  last_accessed timestamptz,
  signed_up_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
DROP INDEX IF EXISTS idx_practices_name_lowercase;
CREATE INDEX IF NOT EXISTS idx_practices_name_lowercase ON practices (name_lowercase);
WITH ranked_active_practices AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY name_lowercase
      ORDER BY updated_at DESC NULLS LAST, signed_up_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM practices
  WHERE is_active = true
)
UPDATE practices
SET is_active = false,
    updated_at = now()
FROM ranked_active_practices
WHERE practices.id = ranked_active_practices.id
  AND ranked_active_practices.rn > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_practices_name_lowercase_active_unique
  ON practices (name_lowercase) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_practices_auth_uid ON practices (auth_uid);

CREATE TABLE IF NOT EXISTS medications (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  badge text NOT NULL CHECK (badge IN ('NEW', 'REAUTH', 'GENERAL')),
  category text NOT NULL,
  key_info text[] DEFAULT '{}',
  nhs_link text DEFAULT '',
  trend_links jsonb DEFAULT '[]',
  sick_days_needed boolean DEFAULT false,
  review_months integer DEFAULT 12,
  content_review_date text DEFAULT '',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE TABLE IF NOT EXISTS users (
  uid uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  global_role text CHECK (global_role IN ('owner', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_global_role ON users (global_role);

CREATE TABLE IF NOT EXISTS practice_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  user_uid uuid NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (practice_id, user_uid)
);
CREATE INDEX IF NOT EXISTS idx_practice_memberships_practice_id ON practice_memberships (practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_memberships_user_uid ON practice_memberships (user_uid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_memberships_default_per_user
  ON practice_memberships (user_uid) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS practice_medication_cards (
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  code text NOT NULL REFERENCES medications(code) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('global', 'custom')),
  title text,
  description text,
  badge text CHECK (badge IN ('NEW', 'REAUTH', 'GENERAL')),
  category text,
  key_info text[] DEFAULT '{}',
  nhs_link text DEFAULT '',
  trend_links jsonb DEFAULT '[]',
  sick_days_needed boolean DEFAULT false,
  review_months integer DEFAULT 12,
  content_review_date text DEFAULT '',
  disclaimer_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (practice_id, code)
);
CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_practice_id ON practice_medication_cards (practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_code ON practice_medication_cards (code);
CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_source_type ON practice_medication_cards (source_type);

CREATE TABLE IF NOT EXISTS login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid uuid,
  email text,
  actor_type text CHECK (actor_type IN ('admin', 'practice')),
  actor_name text,
  actor_id text,
  admin_role text,
  portal text CHECK (portal IN ('admin', 'practice')),
  user_agent text DEFAULT '',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  actor_uid uuid,
  code text,
  timestamp timestamptz DEFAULT now(),
  previous_state jsonb,
  new_state jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);

CREATE TABLE IF NOT EXISTS card_templates (
  template_key text PRIMARY KEY,
  builder_type text NOT NULL CHECK (builder_type IN ('healthcheck', 'screening', 'immunisation', 'ltc')),
  template_id text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_card_templates_builder_type_template_id
  ON card_templates (builder_type, template_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_builder_type
  ON card_templates (builder_type);

CREATE TABLE IF NOT EXISTS card_template_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL REFERENCES card_templates(template_key) ON DELETE CASCADE,
  builder_type text NOT NULL CHECK (builder_type IN ('healthcheck', 'screening', 'immunisation', 'ltc')),
  template_id text NOT NULL,
  label text NOT NULL,
  version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'restored')),
  payload jsonb NOT NULL,
  restored_from_revision_id uuid REFERENCES card_template_revisions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_card_template_revisions_template_key_created_at
  ON card_template_revisions (template_key, created_at DESC);

CREATE TABLE IF NOT EXISTS firebase_uid_map (
  firebase_uid text PRIMARY KEY,
  supabase_uid uuid NOT NULL,
  UNIQUE (supabase_uid)
);

-- RPC FUNCTIONS
CREATE OR REPLACE FUNCTION validate_practice(org_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN RETURN jsonb_build_object('valid', false, 'error', 'Organisation name is required'); END IF;
  IF NOT EXISTS(SELECT 1 FROM practices WHERE name_lowercase = lower(trim(org_name)) AND is_active = true) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice not registered');
  END IF;
  RETURN jsonb_build_object('valid', true);
END;
$$;
GRANT EXECUTE ON FUNCTION validate_practice(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION record_patient_access(org_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN RETURN jsonb_build_object('success', false); END IF;
  UPDATE practices SET last_accessed = now(), link_visit_count = link_visit_count + 1
    WHERE name_lowercase = lower(trim(org_name)) AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION record_patient_access(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION submit_patient_rating(org_name text, rating_value integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Organisation name is required'); END IF;
  IF rating_value < 1 OR rating_value > 5 THEN RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5'); END IF;
  UPDATE practices SET patient_rating_count = patient_rating_count + 1, patient_rating_total = patient_rating_total + rating_value
    WHERE name_lowercase = lower(trim(org_name)) AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Practice not found'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_patient_rating(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION resolve_patient_medication_cards(org_name text, requested_codes text[]) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH selected_practice AS (
    SELECT id
    FROM practices
    WHERE org_name IS NOT NULL
      AND trim(org_name) <> ''
      AND name_lowercase = lower(trim(org_name))
      AND is_active = true
    LIMIT 1
  ), deduped_codes AS (
    SELECT DISTINCT ON (trim(requested.code)) trim(requested.code) AS code, requested.ord
    FROM unnest(COALESCE(requested_codes, ARRAY[]::text[])) WITH ORDINALITY AS requested(code, ord)
    WHERE trim(requested.code) <> ''
    ORDER BY trim(requested.code), requested.ord
  ), ordered_codes AS (
    SELECT code, ord FROM deduped_codes ORDER BY ord
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'state', CASE WHEN cards.source_type = 'custom' THEN 'custom' WHEN cards.source_type = 'global' THEN 'global' ELSE 'placeholder' END,
    'code', ordered_codes.code,
    'badge', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.badge, medications.badge, 'GENERAL')
                   WHEN cards.source_type = 'global' THEN COALESCE(medications.badge, 'GENERAL')
                   WHEN medications.code IS NOT NULL THEN medications.badge ELSE 'GENERAL' END,
    'title', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.title, medications.title, 'Medication information unavailable')
                   WHEN cards.source_type = 'global' THEN COALESCE(medications.title, 'Medication information unavailable')
                   WHEN medications.code IS NOT NULL THEN medications.title ELSE 'Medication information unavailable' END,
    'description', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.description, 'No drug information available at your practice for this particular medication.')
                         WHEN cards.source_type = 'global' THEN COALESCE(medications.description, 'No drug information available at your practice for this particular medication.')
                         ELSE 'No drug information available at your practice for this particular medication.' END,
    'keyInfo', CASE WHEN cards.source_type = 'custom' THEN to_jsonb(COALESCE(cards.key_info, ARRAY[]::text[]))
                     WHEN cards.source_type = 'global' THEN to_jsonb(COALESCE(medications.key_info, ARRAY[]::text[])) ELSE '[]'::jsonb END,
    'nhsLink', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.nhs_link, '')
                     WHEN cards.source_type = 'global' THEN COALESCE(medications.nhs_link, '') ELSE '' END,
    'trendLinks', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.trend_links, '[]'::jsonb)
                        WHEN cards.source_type = 'global' THEN COALESCE(medications.trend_links, '[]'::jsonb) ELSE '[]'::jsonb END,
    'sickDaysNeeded', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.sick_days_needed, false)
                            WHEN cards.source_type = 'global' THEN COALESCE(medications.sick_days_needed, false) ELSE false END,
    'reviewMonths', CASE WHEN cards.source_type = 'custom' THEN to_jsonb(cards.review_months)
                          WHEN cards.source_type = 'global' THEN to_jsonb(medications.review_months)
                          WHEN medications.code IS NOT NULL THEN to_jsonb(medications.review_months) ELSE 'null'::jsonb END
  ) ORDER BY ordered_codes.ord), '[]'::jsonb)
  FROM ordered_codes
  JOIN selected_practice ON true
  LEFT JOIN medications ON medications.code = ordered_codes.code AND medications.is_deleted = false
  LEFT JOIN practice_medication_cards cards ON cards.practice_id = selected_practice.id AND cards.code = ordered_codes.code;
$$;
GRANT EXECUTE ON FUNCTION resolve_patient_medication_cards(text, text[]) TO anon, authenticated;

-- RLS ENABLE
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_medication_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS HELPERS
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true AND global_role IN ('owner', 'admin'));
$$;

CREATE OR REPLACE FUNCTION is_practice_member(target_practice uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM practice_memberships m JOIN users u ON u.uid = m.user_uid
    WHERE m.practice_id = target_practice AND m.user_uid = auth.uid() AND u.is_active = true);
$$;

CREATE OR REPLACE FUNCTION can_bootstrap_admin(target_uid uuid, target_role text) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    auth.uid() = target_uid
    AND target_role = 'owner'
    AND NOT EXISTS (
      SELECT 1
      FROM users
      WHERE is_active = true
        AND global_role IN ('owner', 'admin')
    );
$$;

-- RLS POLICIES
DROP POLICY IF EXISTS "practices_insert_anyone" ON practices;
DROP POLICY IF EXISTS "practices_select_admin" ON practices;
DROP POLICY IF EXISTS "practices_select_member" ON practices;
DROP POLICY IF EXISTS "practices_update_admin" ON practices;
DROP POLICY IF EXISTS "practices_delete_admin" ON practices;

CREATE POLICY "practices_insert_anyone" ON practices FOR INSERT TO authenticated, anon WITH CHECK (
  name IS NOT NULL
  AND trim(name) <> ''
  AND name_lowercase = lower(trim(name))
  AND is_active = false
  AND auth_uid IS NULL
  AND selected_medications = '{}'::text[]
  AND medication_review_dates = '{}'::jsonb
  AND link_visit_count = 0
  AND patient_rating_count = 0
  AND patient_rating_total = 0
  AND last_accessed IS NULL
);
CREATE POLICY "practices_select_admin" ON practices FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "practices_select_member" ON practices FOR SELECT TO authenticated USING (is_practice_member(id));
CREATE POLICY "practices_update_admin" ON practices FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "practices_delete_admin" ON practices FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "medications_select_anyone" ON medications;
DROP POLICY IF EXISTS "medications_insert_admin" ON medications;
DROP POLICY IF EXISTS "medications_update_admin" ON medications;
DROP POLICY IF EXISTS "medications_delete_admin" ON medications;

CREATE POLICY "medications_select_anyone" ON medications FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "medications_insert_admin" ON medications FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "medications_update_admin" ON medications FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "medications_delete_admin" ON medications FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "card_templates_select_anyone" ON card_templates;
DROP POLICY IF EXISTS "card_templates_insert_admin" ON card_templates;
DROP POLICY IF EXISTS "card_templates_update_admin" ON card_templates;
DROP POLICY IF EXISTS "card_templates_delete_admin" ON card_templates;

CREATE POLICY "card_templates_select_anyone" ON card_templates FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "card_templates_insert_admin" ON card_templates FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "card_templates_update_admin" ON card_templates FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "card_templates_delete_admin" ON card_templates FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "card_template_revisions_select_admin" ON card_template_revisions;
DROP POLICY IF EXISTS "card_template_revisions_insert_admin" ON card_template_revisions;

CREATE POLICY "card_template_revisions_select_admin" ON card_template_revisions FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "card_template_revisions_insert_admin" ON card_template_revisions FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_insert_bootstrap_first_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

CREATE POLICY "users_select_admin" ON users FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "users_select_self" ON users FOR SELECT TO authenticated USING (uid = auth.uid());
CREATE POLICY "users_insert_admin" ON users FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "users_insert_bootstrap_first_admin" ON users FOR INSERT TO authenticated WITH CHECK (can_bootstrap_admin(uid, global_role));
CREATE POLICY "users_update_admin" ON users FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "users_delete_admin" ON users FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "practice_memberships_select_admin" ON practice_memberships;
DROP POLICY IF EXISTS "practice_memberships_select_self" ON practice_memberships;
DROP POLICY IF EXISTS "practice_memberships_insert_admin" ON practice_memberships;
DROP POLICY IF EXISTS "practice_memberships_update_admin" ON practice_memberships;
DROP POLICY IF EXISTS "practice_memberships_delete_admin" ON practice_memberships;

CREATE POLICY "practice_memberships_select_admin" ON practice_memberships FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "practice_memberships_select_self" ON practice_memberships FOR SELECT TO authenticated USING (user_uid = auth.uid());
CREATE POLICY "practice_memberships_insert_admin" ON practice_memberships FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "practice_memberships_update_admin" ON practice_memberships FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "practice_memberships_delete_admin" ON practice_memberships FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "practice_medication_cards_select_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_select_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_insert_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_insert_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_update_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_update_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_delete_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_delete_member" ON practice_medication_cards;

CREATE POLICY "practice_medication_cards_select_admin" ON practice_medication_cards FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_select_member" ON practice_medication_cards FOR SELECT TO authenticated USING (is_practice_member(practice_medication_cards.practice_id));
CREATE POLICY "practice_medication_cards_insert_admin" ON practice_medication_cards FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "practice_medication_cards_insert_member" ON practice_medication_cards FOR INSERT TO authenticated WITH CHECK (is_practice_member(practice_medication_cards.practice_id));
CREATE POLICY "practice_medication_cards_update_admin" ON practice_medication_cards FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_update_member" ON practice_medication_cards FOR UPDATE TO authenticated USING (is_practice_member(practice_medication_cards.practice_id)) WITH CHECK (is_practice_member(practice_medication_cards.practice_id));
CREATE POLICY "practice_medication_cards_delete_admin" ON practice_medication_cards FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_delete_member" ON practice_medication_cards FOR DELETE TO authenticated USING (is_practice_member(practice_medication_cards.practice_id));

DROP POLICY IF EXISTS "login_audit_insert_authenticated" ON login_audit;
DROP POLICY IF EXISTS "login_audit_select_admin" ON login_audit;

CREATE POLICY "login_audit_insert_authenticated" ON login_audit FOR INSERT TO authenticated WITH CHECK (uid = auth.uid());
CREATE POLICY "login_audit_select_admin" ON login_audit FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_admin" ON audit_log;

CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "audit_log_insert_admin" ON audit_log FOR INSERT TO authenticated WITH CHECK (is_admin());

-- DEPLOYMENT COMPLETE
