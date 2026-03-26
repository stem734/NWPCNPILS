import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Validate organisation name against signed-up practices in Firestore
 * via Cloud Function
 */
export async function validateOrganisation(orgName: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const validateFunc = httpsCallable(functions, 'validatePractice');
    const result = await validateFunc({ orgName });
    const data = result.data as Record<string, unknown>;

    if (data.valid) {
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

/**
 * Parse medication codes from the codes parameter
 * Accepts: "101,102" or "101,202,301"
 */
export function parseMedicationCodes(codesParam: string): string[] {
  if (!codesParam) return [];

  return codesParam
    .split(',')
    .map(c => c.trim())
    .filter(c => /^[1-5]0[12]$/.test(c));
}
