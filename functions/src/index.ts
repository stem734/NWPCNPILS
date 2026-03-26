import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

/**
 * Validates a practice by organisation name against the practices collection.
 *
 * URL format: ?org=<organisation_name>&codes=101,102
 *
 * Flow:
 * 1. Practice signs up → org name stored in Firestore
 * 2. SystmOne protocol auto-fills <organisation_name> into URL
 * 3. React app calls this function with the org name
 * 4. If org exists and is active → show medications
 * 5. If not → blocked
 */
export const validatePractice = onCall(
  { region: 'europe-west2', maxInstances: 100 },
  async (request): Promise<{ valid: boolean; error?: string }> => {
    const { orgName } = request.data as { orgName: string };

    if (!orgName || typeof orgName !== 'string') {
      throw new HttpsError('invalid-argument', 'Organisation name is required');
    }

    try {
      // Look up by organisation name (case-insensitive via lowercase field)
      const practicesRef = db.collection('practices');
      const snapshot = await practicesRef
        .where('name_lowercase', '==', orgName.toLowerCase().trim())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { valid: false, error: 'Practice not registered' };
      }

      const practiceDoc = snapshot.docs[0];
      const practice = practiceDoc.data();

      if (!practice.is_active) {
        return { valid: false, error: 'Practice subscription is inactive' };
      }

      // Update last_accessed timestamp
      await practiceDoc.ref.update({
        last_accessed: Timestamp.now(),
      });

      return { valid: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Error validating practice:', error);
      throw new HttpsError('internal', 'Unable to validate practice');
    }
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = onCall({ region: 'europe-west2' }, async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
