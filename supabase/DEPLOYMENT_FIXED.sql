-- =================================================================
-- MyMedInfo: Complete Supabase Deployment SQL (FIXED)
-- =================================================================
-- Copy everything from this file and paste into Supabase SQL Editor
-- Run all at once - it's idempotent and safe to re-run
-- =================================================================

-- STEP 1: CREATE ALL TABLES FIRST
-- =================================================================

CREATE TABLE IF NOT EXISTS practices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  name_lowercase          text NOT NULL,
  ods_code                text,
  contact_email           text,
  contact_name            text,
  is_active               boolean NOT NULL DEFAULT false,
  auth_uid                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_medications    text[] DEFAULT '{}',
  medication_review_dates jsonb DEFAULT '{}',
  healthcheck_enabled     boolean NOT NULL DEFAULT false,
  screening_enabled       boolean NOT NULL DEFAULT false,
  immunisation_enabled    boolean NOT NULL DEFAULT false,
  ltc_enabled             boolean NOT NULL DEFAULT false,
  link_visit_count        integer NOT NULL DEFAULT 0,
  patient_rating_count    integer NOT NULL DEFAULT 0,
  patient_rating_total    integer NOT NULL DEFAULT 0,
  last_accessed           timestamptz,
  signed_up_at            timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practices_name_lowercase ON practices (name_lowercase);
CREATE INDEX IF NOT EXISTS idx_practices_auth_uid ON practices (auth_uid);

CREATE TABLE IF NOT EXISTS medications (
  code                text PRIMARY KEY,
  title               text NOT NULL,
  description         text NOT NULL,
  badge               text NOT NULL CHECK (badge IN ('NEW', 'REAUTH', 'GENERAL')),
  category            text NOT NULL,
  key_info            text[] DEFAULT '{}',
  nhs_link            text DEFAULT '',
  trend_links         jsonb DEFAULT '[]',
  sick_days_needed    boolean DEFAULT false,
  review_months       integer DEFAULT 12,
  content_review_date text DEFAULT '',
  is_deleted          boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz DEFAULT now(),
  updated_by          uuid,
  deleted_at          timestamptz,
  deleted_by          uuid
);

CREATE TABLE IF NOT EXISTS users (
  uid        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  global_role text CHECK (global_role IN ('owner', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_global_role ON users (global_role);

CREATE TABLE IF NOT EXISTS practice_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  user_uid    uuid NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (practice_id, user_uid)
);

CREATE INDEX IF NOT EXISTS idx_practice_memberships_practice_id ON practice_memberships (practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_memberships_user_uid ON practice_memberships (user_uid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_memberships_default_per_user
  ON practice_memberships (user_uid) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS practice_medication_cards (
  practice_id          uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  code                 text NOT NULL REFERENCES medications(code) ON DELETE CASCADE,
  source_type          text NOT NULL CHECK (source_type IN ('global', 'custom')),
  title                text,
  description          text,
  badge                text CHECK (badge IN ('NEW', 'REAUTH', 'GENERAL')),
  category             text,
  key_info             text[] DEFAULT '{}',
  nhs_link             text DEFAULT '',
  trend_links          jsonb DEFAULT '[]',
  sick_days_needed     boolean DEFAULT false,
  review_months        integer DEFAULT 12,
  content_review_date  text DEFAULT '',
  disclaimer_version   text NOT NULL,
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  accepted_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (practice_id, code)
);

CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_practice_id
  ON practice_medication_cards (practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_code
  ON practice_medication_cards (code);
CREATE INDEX IF NOT EXISTS idx_practice_medication_cards_source_type
  ON practice_medication_cards (source_type);

CREATE TABLE IF NOT EXISTS login_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         uuid,
  email       text,
  actor_type  text CHECK (actor_type IN ('admin', 'practice')),
  actor_name  text,
  actor_id    text,
  admin_role  text,
  portal      text CHECK (portal IN ('admin', 'practice')),
  user_agent  text DEFAULT '',
  ip_address  text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit (created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  actor_uid      uuid,
  code           text,
  timestamp      timestamptz DEFAULT now(),
  previous_state jsonb,
  new_state      jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);

CREATE TABLE IF NOT EXISTS firebase_uid_map (
  firebase_uid text PRIMARY KEY,
  supabase_uid uuid NOT NULL,
  UNIQUE (supabase_uid)
);

-- STEP 2: CREATE RPC FUNCTIONS (after tables exist)
-- =================================================================

CREATE OR REPLACE FUNCTION validate_practice(org_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  practice_record practices%ROWTYPE;
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Organisation name is required');
  END IF;

  SELECT * INTO practice_record FROM practices
  WHERE name_lowercase = lower(trim(org_name)) LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice not registered');
  END IF;

  IF NOT practice_record.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice subscription is inactive');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'healthcheck_enabled', practice_record.healthcheck_enabled,
    'screening_enabled', practice_record.screening_enabled,
    'immunisation_enabled', practice_record.immunisation_enabled,
    'ltc_enabled', practice_record.ltc_enabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_practice TO anon;
GRANT EXECUTE ON FUNCTION validate_practice TO authenticated;

CREATE OR REPLACE FUNCTION record_patient_access(org_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE practices
  SET last_accessed = now(), link_visit_count = link_visit_count + 1
  WHERE name_lowercase = lower(trim(org_name)) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION record_patient_access TO anon;
GRANT EXECUTE ON FUNCTION record_patient_access TO authenticated;

CREATE OR REPLACE FUNCTION submit_patient_rating(org_name text, rating_value integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organisation name is required');
  END IF;

  IF rating_value < 1 OR rating_value > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  END IF;

  UPDATE practices
  SET patient_rating_count = patient_rating_count + 1,
      patient_rating_total = patient_rating_total + rating_value
  WHERE name_lowercase = lower(trim(org_name));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Practice not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_patient_rating TO anon;
GRANT EXECUTE ON FUNCTION submit_patient_rating TO authenticated;

CREATE OR REPLACE FUNCTION resolve_patient_medication_cards(org_name text, requested_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  practice_record practices%ROWTYPE;
  resolved_cards jsonb;
  placeholder_message constant text := 'No drug information available at your practice for this particular medication.';
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT * INTO practice_record FROM practices
  WHERE name_lowercase = lower(trim(org_name)) AND is_active = true LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH deduped_codes AS (
    SELECT DISTINCT ON (trim(requested.code)) trim(requested.code) AS code, requested.ord
    FROM unnest(COALESCE(requested_codes, ARRAY[]::text[]))
      WITH ORDINALITY AS requested(code, ord)
    WHERE trim(requested.code) <> ''
    ORDER BY trim(requested.code), requested.ord
  ),
  ordered_codes AS (
    SELECT code, ord FROM deduped_codes ORDER BY ord
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'state', CASE WHEN cards.source_type = 'custom' THEN 'custom'
                      WHEN cards.source_type = 'global' THEN 'global' ELSE 'placeholder' END,
        'code', ordered_codes.code,
        'badge', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.badge, medications.badge, 'GENERAL')
                       WHEN cards.source_type = 'global' THEN COALESCE(medications.badge, 'GENERAL')
                       WHEN medications.code IS NOT NULL THEN medications.badge ELSE 'GENERAL' END,
        'title', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.title, medications.title, 'Medication information unavailable')
                       WHEN cards.source_type = 'global' THEN COALESCE(medications.title, 'Medication information unavailable')
                       WHEN medications.code IS NOT NULL THEN medications.title ELSE 'Medication information unavailable' END,
        'description', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.description, placeholder_message)
                             WHEN cards.source_type = 'global' THEN COALESCE(medications.description, placeholder_message)
                             ELSE placeholder_message END,
        'keyInfo', CASE WHEN cards.source_type = 'custom' THEN to_jsonb(COALESCE(cards.key_info, ARRAY[]::text[]))
                         WHEN cards.source_type = 'global' THEN to_jsonb(COALESCE(medications.key_info, ARRAY[]::text[]))
                         ELSE '[]'::jsonb END,
        'nhsLink', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.nhs_link, '')
                         WHEN cards.source_type = 'global' THEN COALESCE(medications.nhs_link, '') ELSE '' END,
        'trendLinks', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.trend_links, '[]'::jsonb)
                            WHEN cards.source_type = 'global' THEN COALESCE(medications.trend_links, '[]'::jsonb)
                            ELSE '[]'::jsonb END,
        'sickDaysNeeded', CASE WHEN cards.source_type = 'custom' THEN COALESCE(cards.sick_days_needed, false)
                                WHEN cards.source_type = 'global' THEN COALESCE(medications.sick_days_needed, false)
                                ELSE false END,
        'reviewMonths', CASE WHEN cards.source_type = 'custom' THEN to_jsonb(cards.review_months)
                              WHEN cards.source_type = 'global' THEN to_jsonb(medications.review_months)
                              WHEN medications.code IS NOT NULL THEN to_jsonb(medications.review_months)
                              ELSE 'null'::jsonb END
      ) ORDER BY ordered_codes.ord
    ), '[]'::jsonb
  ) INTO resolved_cards
  FROM ordered_codes
  LEFT JOIN medications ON medications.code = ordered_codes.code AND medications.is_deleted = false
  LEFT JOIN practice_medication_cards cards ON cards.practice_id = practice_record.id AND cards.code = ordered_codes.code;

  RETURN resolved_cards;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_patient_medication_cards TO anon;
GRANT EXECUTE ON FUNCTION resolve_patient_medication_cards TO authenticated;

-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- =================================================================

ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_medication_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true AND global_role IN ('owner', 'admin'));
$$;

CREATE OR REPLACE FUNCTION is_practice_user()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION is_practice_member(target_practice uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM practice_memberships memberships JOIN users ON users.uid = memberships.user_uid
    WHERE memberships.practice_id = target_practice AND memberships.user_uid = auth.uid() AND users.is_active = true);
$$;

-- PRACTICES POLICIES
DROP POLICY IF EXISTS "practices_insert_anyone" ON practices;
DROP POLICY IF EXISTS "practices_select_admin" ON practices;
DROP POLICY IF EXISTS "practices_select_member" ON practices;
DROP POLICY IF EXISTS "practices_update_admin" ON practices;
DROP POLICY IF EXISTS "practices_delete_admin" ON practices;

CREATE POLICY "practices_insert_anyone" ON practices FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "practices_select_admin" ON practices FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "practices_select_member" ON practices FOR SELECT TO authenticated USING (is_practice_member(id));
CREATE POLICY "practices_update_admin" ON practices FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "practices_delete_admin" ON practices FOR DELETE TO authenticated USING (is_admin());

-- MEDICATIONS POLICIES
DROP POLICY IF EXISTS "medications_select_anyone" ON medications;
DROP POLICY IF EXISTS "medications_insert_admin" ON medications;
DROP POLICY IF EXISTS "medications_update_admin" ON medications;
DROP POLICY IF EXISTS "medications_delete_admin" ON medications;

CREATE POLICY "medications_select_anyone" ON medications FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "medications_insert_admin" ON medications FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "medications_update_admin" ON medications FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "medications_delete_admin" ON medications FOR DELETE TO authenticated USING (is_admin());

-- USERS POLICIES
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

CREATE POLICY "users_select_admin" ON users FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "users_select_self" ON users FOR SELECT TO authenticated USING (uid = auth.uid());
CREATE POLICY "users_insert_admin" ON users FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "users_update_admin" ON users FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "users_delete_admin" ON users FOR DELETE TO authenticated USING (is_admin());

-- PRACTICE_MEMBERSHIPS POLICIES
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

-- PRACTICE_MEDICATION_CARDS POLICIES
DROP POLICY IF EXISTS "practice_medication_cards_select_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_select_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_insert_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_insert_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_update_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_update_member" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_delete_admin" ON practice_medication_cards;
DROP POLICY IF EXISTS "practice_medication_cards_delete_member" ON practice_medication_cards;

CREATE POLICY "practice_medication_cards_select_admin" ON practice_medication_cards FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_select_member" ON practice_medication_cards FOR SELECT TO authenticated USING (is_practice_member(practice_id));
CREATE POLICY "practice_medication_cards_insert_admin" ON practice_medication_cards FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "practice_medication_cards_insert_member" ON practice_medication_cards FOR INSERT TO authenticated WITH CHECK (is_practice_member(practice_id));
CREATE POLICY "practice_medication_cards_update_admin" ON practice_medication_cards FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_update_member" ON practice_medication_cards FOR UPDATE TO authenticated USING (is_practice_member(practice_id)) WITH CHECK (is_practice_member(practice_id));
CREATE POLICY "practice_medication_cards_delete_admin" ON practice_medication_cards FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "practice_medication_cards_delete_member" ON practice_medication_cards FOR DELETE TO authenticated USING (is_practice_member(practice_id));

-- LOGIN_AUDIT POLICIES
DROP POLICY IF EXISTS "login_audit_insert_authenticated" ON login_audit;
DROP POLICY IF EXISTS "login_audit_select_admin" ON login_audit;

CREATE POLICY "login_audit_insert_authenticated" ON login_audit FOR INSERT TO authenticated WITH CHECK (uid = auth.uid());
CREATE POLICY "login_audit_select_admin" ON login_audit FOR SELECT TO authenticated USING (is_admin());

-- AUDIT_LOG POLICIES
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_admin" ON audit_log;

CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "audit_log_insert_admin" ON audit_log FOR INSERT TO authenticated WITH CHECK (is_admin());

-- DEPLOYMENT COMPLETE
