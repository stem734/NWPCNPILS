-- =============================================================================
-- Resolve Supabase RLS advisor warnings for intentionally internal tables.
--
-- These policies keep browser clients locked out while satisfying the advisor
-- rule that RLS-enabled tables should have explicit policies.
-- Safe to re-run.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.firebase_uid_map') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.firebase_uid_map ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "firebase_uid_map_no_client_access" ON public.firebase_uid_map';
    EXECUTE '
      CREATE POLICY "firebase_uid_map_no_client_access"
      ON public.firebase_uid_map FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false)
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.patient_rating_submissions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.patient_rating_submissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "patient_rating_submissions_no_client_access" ON public.patient_rating_submissions';
    EXECUTE '
      CREATE POLICY "patient_rating_submissions_no_client_access"
      ON public.patient_rating_submissions FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false)
    ';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
