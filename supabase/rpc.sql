-- =============================================================================
-- MyMedInfo: PostgreSQL RPC functions for public/patient-facing operations
-- These replace Firebase Cloud Functions that need atomic writes or anon access.
-- Run this AFTER schema.sql and rls.sql in the Supabase SQL Editor.
-- =============================================================================

-- ===================
-- validate_practice(org_name text)
-- Replaces Firebase: validatePractice
-- Called by anonymous patients to check if a practice is registered and active.
-- ===================
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

  SELECT * INTO practice_record
  FROM practices
  WHERE name_lowercase = lower(trim(org_name))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice not registered');
  END IF;

  IF NOT practice_record.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice subscription is inactive');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_practice TO anon;
GRANT EXECUTE ON FUNCTION validate_practice TO authenticated;

-- ===================
-- record_patient_access(org_name text)
-- Replaces Firebase: recordPatientAccess
-- Atomically increments link_visit_count and updates last_accessed.
-- Called by anonymous patients when they view medication info.
-- ===================
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
  SET last_accessed = now(),
      link_visit_count = link_visit_count + 1
  WHERE name_lowercase = lower(trim(org_name))
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION record_patient_access TO anon;
GRANT EXECUTE ON FUNCTION record_patient_access TO authenticated;

-- ===================
-- submit_patient_rating(org_name text, rating_value integer)
-- Replaces Firebase: submitPatientRating
-- Atomically increments patient_rating_count and patient_rating_total.
-- Called by anonymous patients to rate their experience.
-- ===================
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
