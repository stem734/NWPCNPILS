import { supabase } from './supabase';

/**
 * Validate organisation name against signed-up practices in Supabase
 * via PostgreSQL RPC function.
 */
export async function validateOrganisation(orgName: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('validate_practice', { org_name: orgName });

    if (error) {
      console.error('Organisation validation error:', error);
      return { valid: false, error: 'Unable to verify practice. Please try again later.' };
    }

    if (data?.valid) {
      return { valid: true };
    }

    return {
      valid: false,
      error: 'This practice is not registered with MyMedInfo.',
    };
  } catch (error) {
    console.error('Organisation validation error:', error);
    return {
      valid: false,
      error: 'Unable to verify practice. Please try again later.',
    };
  }
}

export async function recordPatientAccess(orgName: string): Promise<void> {
  if (!orgName.trim()) return;

  try {
    await supabase.rpc('record_patient_access', { org_name: orgName });
  } catch (error) {
    console.error('Patient access logging error:', error);
  }
}

/**
 * Parse medication codes from the codes parameter
 * Accepts: "101,102" or "101,202,301"
 */
export function parseMedicationCodes(codesParam: string): string[] {
  if (!codesParam) return [];

  return codesParam
    .split(',')
    .map(c => c.trim())
    .filter(c => /^\d0[12]$/.test(c));
}
