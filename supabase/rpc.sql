-- =============================================================================
-- MyMedInfo: PostgreSQL RPC functions for public/patient-facing operations
-- These replace Firebase Cloud Functions that need atomic writes or anon access.
-- Run this AFTER schema.sql and rls.sql in the Supabase SQL Editor.
-- =============================================================================

-- ===================
-- validate_practice(org_name text)
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

  SELECT *
  INTO practice_record
  FROM practices
  WHERE name_lowercase = lower(trim(org_name))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice not registered');
  END IF;

  IF NOT practice_record.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Practice subscription is inactive');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'medication_enabled', practice_record.medication_enabled,
    'healthcheck_enabled', practice_record.healthcheck_enabled,
    'screening_enabled', practice_record.screening_enabled,
    'immunisation_enabled', practice_record.immunisation_enabled,
    'ltc_enabled', practice_record.ltc_enabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_practice TO anon;
GRANT EXECUTE ON FUNCTION validate_practice TO authenticated;

-- ===================
-- record_patient_access(org_name text)
-- Atomically increments link_visit_count and updates last_accessed.
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
-- patient_rating_submissions: rolling-window rate-limit log for ratings.
-- The RPC caps submissions per practice per minute to prevent abuse of
-- the anon-callable submit_patient_rating RPC.
-- ===================
CREATE TABLE IF NOT EXISTS patient_rating_submissions (
  id bigserial PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_rating_submissions_practice_time
  ON patient_rating_submissions (practice_id, submitted_at DESC);

ALTER TABLE patient_rating_submissions ENABLE ROW LEVEL SECURITY;
-- No policies: only the SECURITY DEFINER RPC below touches this table.

-- ===================
-- submit_patient_rating(org_name text, rating_value integer)
-- Atomically increments patient_rating_count and patient_rating_total,
-- with a rolling-window rate-limit of 10 submissions per practice per
-- minute to discourage brute-force skewing of scores.
-- ===================
CREATE OR REPLACE FUNCTION submit_patient_rating(org_name text, rating_value integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_practice_id uuid;
  recent_submissions integer;
  rate_limit_per_minute constant integer := 10;
BEGIN
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organisation name is required');
  END IF;

  IF rating_value < 1 OR rating_value > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 1 and 5');
  END IF;

  SELECT id INTO target_practice_id
  FROM practices
  WHERE name_lowercase = lower(trim(org_name))
    AND is_active = true
  LIMIT 1;

  IF target_practice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Practice not found');
  END IF;

  -- Opportunistically garbage-collect log entries older than 1 hour to
  -- keep the table small; this runs inside the RPC transaction.
  DELETE FROM patient_rating_submissions
  WHERE submitted_at < now() - interval '1 hour';

  SELECT count(*) INTO recent_submissions
  FROM patient_rating_submissions
  WHERE practice_id = target_practice_id
    AND submitted_at > now() - interval '1 minute';

  IF recent_submissions >= rate_limit_per_minute THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many ratings recently. Please try again in a minute.',
      'rate_limited', true
    );
  END IF;

  INSERT INTO patient_rating_submissions (practice_id)
  VALUES (target_practice_id);

  UPDATE practices
  SET patient_rating_count = patient_rating_count + 1,
      patient_rating_total = patient_rating_total + rating_value
  WHERE id = target_practice_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_patient_rating TO anon;
GRANT EXECUTE ON FUNCTION submit_patient_rating TO authenticated;

-- ===================
-- resolve_patient_medication_cards(org_name text, requested_codes text[])
-- Resolves a patient request to the practice-specific card, accepted global card,
-- or placeholder state for each requested medication code.
-- ===================
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

  IF COALESCE(array_length(requested_codes, 1), 0) > 50 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT *
  INTO practice_record
  FROM practices
  WHERE name_lowercase = lower(trim(org_name))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT practice_record.medication_enabled THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH deduped_codes AS (
    SELECT DISTINCT ON (trim(requested.code))
      trim(requested.code) AS code,
      requested.ord
    FROM unnest(COALESCE(requested_codes, ARRAY[]::text[]))
      WITH ORDINALITY AS requested(code, ord)
    WHERE trim(requested.code) <> ''
    ORDER BY trim(requested.code), requested.ord
  ),
  ordered_codes AS (
    SELECT code, ord
    FROM deduped_codes
    ORDER BY ord
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'state',
        CASE
          WHEN cards.source_type = 'custom' THEN 'custom'
          WHEN cards.source_type = 'global' THEN 'global'
          ELSE 'placeholder'
        END,
        'code', ordered_codes.code,
        'badge',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.badge, medications.badge, 'GENERAL')
          WHEN cards.source_type = 'global' THEN COALESCE(medications.badge, 'GENERAL')
          WHEN medications.code IS NOT NULL THEN medications.badge
          ELSE 'GENERAL'
        END,
        'title',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.title, medications.title, 'Medication information unavailable')
          WHEN cards.source_type = 'global' THEN COALESCE(medications.title, 'Medication information unavailable')
          WHEN medications.code IS NOT NULL THEN medications.title
          ELSE 'Medication information unavailable'
        END,
        'description',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.description, placeholder_message)
          WHEN cards.source_type = 'global' THEN COALESCE(medications.description, placeholder_message)
          ELSE placeholder_message
        END,
        'keyInfo',
        CASE
          WHEN cards.source_type = 'custom' THEN to_jsonb(COALESCE(cards.key_info, ARRAY[]::text[]))
          WHEN cards.source_type = 'global' THEN to_jsonb(COALESCE(medications.key_info, ARRAY[]::text[]))
          ELSE '[]'::jsonb
        END,
        'nhsLink',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.nhs_link, '')
          WHEN cards.source_type = 'global' THEN COALESCE(medications.nhs_link, '')
          ELSE ''
        END,
        'trendLinks',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.trend_links, '[]'::jsonb)
          WHEN cards.source_type = 'global' THEN COALESCE(medications.trend_links, '[]'::jsonb)
          ELSE '[]'::jsonb
        END,
        'sickDaysNeeded',
        CASE
          WHEN cards.source_type = 'custom' THEN COALESCE(cards.sick_days_needed, false)
          WHEN cards.source_type = 'global' THEN COALESCE(medications.sick_days_needed, false)
          ELSE false
        END,
        'reviewMonths',
        CASE
          WHEN cards.source_type = 'custom' THEN to_jsonb(cards.review_months)
          WHEN cards.source_type = 'global' THEN to_jsonb(medications.review_months)
          WHEN medications.code IS NOT NULL THEN to_jsonb(medications.review_months)
          ELSE 'null'::jsonb
        END
      )
      ORDER BY ordered_codes.ord
    ),
    '[]'::jsonb
  )
  INTO resolved_cards
  FROM ordered_codes
  LEFT JOIN medications
    ON medications.code = ordered_codes.code
   AND medications.is_deleted = false
  LEFT JOIN practice_medication_cards cards
    ON cards.practice_id = practice_record.id
   AND cards.code = ordered_codes.code;

  RETURN resolved_cards;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_patient_medication_cards TO anon;
GRANT EXECUTE ON FUNCTION resolve_patient_medication_cards TO authenticated;
