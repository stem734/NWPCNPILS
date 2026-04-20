import { DEFAULT_PRACTICE_FEATURE_SETTINGS, coercePracticeFeatureSettings, type PracticeFeatureSettings } from './practiceFeatures';
import { supabase } from './supabase';
import { resolvePatientMedicationCards, type ResolvedMedicationCard } from './practicePortal';

/**
 * Validate organisation name against signed-up practices in Supabase
 * via PostgreSQL RPC function.
 */
export async function validateOrganisation(orgName: string): Promise<{
  valid: boolean;
  error?: string;
  practiceFeatures: PracticeFeatureSettings;
}> {
  try {
    const { data, error } = await supabase.rpc('validate_practice', { org_name: orgName });

    if (error) {
      console.error('Organisation validation error:', error);
      return {
        valid: false,
        error: 'Unable to verify practice. Please try again later.',
        practiceFeatures: DEFAULT_PRACTICE_FEATURE_SETTINGS,
      };
    }

    if (data?.valid) {
      return {
        valid: true,
        practiceFeatures: coercePracticeFeatureSettings(data),
      };
    }

    return {
      valid: false,
      error: 'This practice is not registered with MyMedInfo.',
      practiceFeatures: DEFAULT_PRACTICE_FEATURE_SETTINGS,
    };
  } catch (error) {
    console.error('Organisation validation error:', error);
    return {
      valid: false,
      error: 'Unable to verify practice. Please try again later.',
      practiceFeatures: DEFAULT_PRACTICE_FEATURE_SETTINGS,
    };
  }
}

/**
 * Records a patient access and reports whether the practice is still
 * valid. The server returns `null`/an error when the practice has been
 * deactivated so the caller can invalidate any cached validation.
 */
export async function recordPatientAccess(orgName: string): Promise<{ ok: boolean }> {
  if (!orgName.trim()) return { ok: true };

  try {
    const { error } = await supabase.rpc('record_patient_access', { org_name: orgName });
    if (error) {
      console.error('Patient access logging error:', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error('Patient access logging error:', error);
    return { ok: false };
  }
}

/**
 * Parse medication codes from the codes parameter
 * Accepts any comma-separated 3-digit medication codes
 */
export function parseMedicationCodes(codesParam: string): string[] {
  if (!codesParam) return [];

  return codesParam
    .split(',')
    .map(c => c.trim())
    .filter(c => /^\d{3}$/.test(c));
}

export type MedicationResolutionResult =
  | { ok: true; cards: ResolvedMedicationCard[] }
  | { ok: false; error: string };

export async function resolveOrganisationMedicationCards(
  orgName: string,
  codes: string[],
): Promise<MedicationResolutionResult> {
  if (!orgName.trim() || codes.length === 0) {
    return { ok: true, cards: [] };
  }

  try {
    const cards = await resolvePatientMedicationCards(orgName, codes);
    return { ok: true, cards };
  } catch (error) {
    console.error('Medication resolution error:', error);
    return {
      ok: false,
      error:
        'We could not load your medication information right now. Please check your internet connection and try again.',
    };
  }
}
