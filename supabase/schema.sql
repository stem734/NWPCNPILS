-- =============================================================================
-- MyMedInfo: PostgreSQL schema for Supabase (replaces Firestore collections)
-- Run this in the Supabase SQL Editor after creating your project.
-- =============================================================================

-- ===================
-- PRACTICES TABLE
-- Replaces Firestore /practices/{id}
-- ===================
CREATE TABLE practices (
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
  link_visit_count        integer NOT NULL DEFAULT 0,
  patient_rating_count    integer NOT NULL DEFAULT 0,
  patient_rating_total    integer NOT NULL DEFAULT 0,
  last_accessed           timestamptz,
  signed_up_at            timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX idx_practices_name_lowercase ON practices (name_lowercase);
CREATE INDEX idx_practices_auth_uid ON practices (auth_uid);

-- ===================
-- MEDICATIONS TABLE
-- Replaces Firestore /medications/{code}
-- ===================
CREATE TABLE medications (
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

-- ===================
-- CARD_TEMPLATES TABLE
-- Shared non-medication card templates used by the builder and patient views
-- ===================
CREATE TABLE card_templates (
  template_key        text PRIMARY KEY,
  builder_type        text NOT NULL CHECK (builder_type IN ('healthcheck', 'screening', 'immunisation', 'ltc')),
  template_id         text NOT NULL,
  label               text NOT NULL,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz DEFAULT now(),
  created_by          uuid,
  updated_at          timestamptz DEFAULT now(),
  updated_by          uuid
);

CREATE UNIQUE INDEX idx_card_templates_builder_type_template_id
  ON card_templates (builder_type, template_id);
CREATE INDEX idx_card_templates_builder_type
  ON card_templates (builder_type);

-- ===================
-- CARD_TEMPLATE_REVISIONS TABLE
-- Immutable revision history for shared non-medication card templates
-- ===================
CREATE TABLE card_template_revisions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key            text NOT NULL REFERENCES card_templates(template_key) ON DELETE CASCADE,
  builder_type            text NOT NULL CHECK (builder_type IN ('healthcheck', 'screening', 'immunisation', 'ltc')),
  template_id             text NOT NULL,
  label                   text NOT NULL,
  version                 integer NOT NULL,
  action                  text NOT NULL CHECK (action IN ('created', 'updated', 'restored')),
  payload                 jsonb NOT NULL,
  restored_from_revision_id uuid REFERENCES card_template_revisions(id) ON DELETE SET NULL,
  created_at              timestamptz DEFAULT now(),
  created_by              uuid
);

CREATE INDEX idx_card_template_revisions_template_key_created_at
  ON card_template_revisions (template_key, created_at DESC);

-- ===================
-- USERS TABLE
-- Unified application user records for both global admins and practice members
-- ===================
CREATE TABLE users (
  uid        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  global_role text CHECK (global_role IN ('owner', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_global_role ON users (global_role);

-- ===================
-- PRACTICE_MEMBERSHIPS TABLE
-- Links application users to one or more practices
-- ===================
CREATE TABLE practice_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  user_uid    uuid NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (practice_id, user_uid)
);

CREATE INDEX idx_practice_memberships_practice_id ON practice_memberships (practice_id);
CREATE INDEX idx_practice_memberships_user_uid ON practice_memberships (user_uid);
CREATE UNIQUE INDEX idx_practice_memberships_default_per_user
  ON practice_memberships (user_uid)
  WHERE is_default = true;

-- ===================
-- PRACTICE_MEDICATION_CARDS TABLE
-- Practice-specific adopted or custom medication cards
-- Row absence means "unconfigured"
-- ===================
CREATE TABLE practice_medication_cards (
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

CREATE INDEX idx_practice_medication_cards_practice_id
  ON practice_medication_cards (practice_id);
CREATE INDEX idx_practice_medication_cards_code
  ON practice_medication_cards (code);
CREATE INDEX idx_practice_medication_cards_source_type
  ON practice_medication_cards (source_type);

-- ===================
-- LOGIN_AUDIT TABLE
-- Replaces Firestore /login_audit/{id}
-- ===================
CREATE TABLE login_audit (
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

CREATE INDEX idx_login_audit_created_at ON login_audit (created_at DESC);

-- ===================
-- AUDIT_LOG TABLE
-- Replaces Firestore /audit_log/{id}
-- ===================
CREATE TABLE audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action         text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  actor_uid      uuid,
  code           text,
  timestamp      timestamptz DEFAULT now(),
  previous_state jsonb,
  new_state      jsonb
);

CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);

-- ===================
-- SYNC TRIGGER: practice_medication_cards → practices
-- Keeps practices.selected_medications and practices.medication_review_dates
-- derived from practice_medication_cards, eliminating dual-write drift.
-- Application code may still write these columns directly; the trigger
-- overwrites them after every card change to enforce DB-level consistency.
-- TODO: once app code is updated to read from practice_medication_cards
-- directly, drop this trigger and the two redundant columns on practices.
-- ===================
CREATE OR REPLACE FUNCTION sync_practice_medications_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  target_practice_id uuid;
BEGIN
  target_practice_id := COALESCE(NEW.practice_id, OLD.practice_id);

  UPDATE practices
  SET
    selected_medications = (
      SELECT COALESCE(array_agg(code ORDER BY code), '{}'::text[])
      FROM practice_medication_cards
      WHERE practice_id = target_practice_id
    ),
    medication_review_dates = (
      SELECT COALESCE(
        jsonb_object_agg(code, content_review_date),
        '{}'::jsonb
      )
      FROM practice_medication_cards
      WHERE practice_id = target_practice_id
        AND content_review_date IS NOT NULL
        AND content_review_date <> ''
    )
  WHERE id = target_practice_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_practice_medications_cache
  AFTER INSERT OR UPDATE OR DELETE ON practice_medication_cards
  FOR EACH ROW EXECUTE FUNCTION sync_practice_medications_cache();

-- ===================
-- FIREBASE_UID_MAP TABLE (temporary, for migration only)
-- Maps old Firebase Auth UIDs to new Supabase Auth UUIDs
-- Drop this table after migration is verified.
-- ===================
CREATE TABLE firebase_uid_map (
  firebase_uid text PRIMARY KEY,
  supabase_uid uuid NOT NULL UNIQUE
);
