-- =============================================================================
-- Migration: add a rolling-window rate-limit to submit_patient_rating.
-- Safe to re-run; wraps everything in IF NOT EXISTS / CREATE OR REPLACE.
-- Apply in the Supabase SQL Editor after the initial rpc.sql has been run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_rating_submissions (
  id bigserial PRIMARY KEY,
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_rating_submissions_practice_time
  ON patient_rating_submissions (practice_id, submitted_at DESC);

ALTER TABLE patient_rating_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patient_rating_submissions_no_client_access" ON patient_rating_submissions;

CREATE POLICY "patient_rating_submissions_no_client_access"
  ON patient_rating_submissions FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION submit_patient_rating(org_name text, rating_value integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  FROM public.practices
  WHERE name_lowercase = lower(trim(org_name))
    AND is_active = true
  LIMIT 1;

  IF target_practice_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Practice not found');
  END IF;

  DELETE FROM public.patient_rating_submissions
  WHERE submitted_at < now() - interval '1 hour';

  SELECT count(*) INTO recent_submissions
  FROM public.patient_rating_submissions
  WHERE practice_id = target_practice_id
    AND submitted_at > now() - interval '1 minute';

  IF recent_submissions >= rate_limit_per_minute THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Too many ratings recently. Please try again in a minute.',
      'rate_limited', true
    );
  END IF;

  INSERT INTO public.patient_rating_submissions (practice_id)
  VALUES (target_practice_id);

  UPDATE public.practices
  SET patient_rating_count = patient_rating_count + 1,
      patient_rating_total = patient_rating_total + rating_value
  WHERE id = target_practice_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_patient_rating TO anon;
GRANT EXECUTE ON FUNCTION submit_patient_rating TO authenticated;
