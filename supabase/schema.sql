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
-- ADMINS TABLE
-- Replaces Firestore /admins/{uid}
-- ===================
CREATE TABLE admins (
  uid        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  role       text NOT NULL CHECK (role IN ('owner', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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
-- FIREBASE_UID_MAP TABLE (temporary, for migration only)
-- Maps old Firebase Auth UIDs to new Supabase Auth UUIDs
-- Drop this table after migration is verified.
-- ===================
CREATE TABLE firebase_uid_map (
  firebase_uid text PRIMARY KEY,
  supabase_uid uuid NOT NULL UNIQUE
);
