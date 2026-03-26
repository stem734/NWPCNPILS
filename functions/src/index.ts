import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

/**
 * Validates a practice by organisation name against the practices collection.
 */
export const validatePractice = onCall(
  { region: 'europe-west2', maxInstances: 100 },
  async (request): Promise<{ valid: boolean; error?: string }> => {
    const { orgName } = request.data as { orgName: string };

    if (!orgName || typeof orgName !== 'string') {
      throw new HttpsError('invalid-argument', 'Organisation name is required');
    }

    try {
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
 * Creates a Firebase Auth account for a practice user and links it to their practice.
 * Called by admin when adding a practice. Sends a password reset email so the
 * practice user can set their own password.
 */
export const createPracticeUser = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean; uid?: string; error?: string }> => {
    // Only authenticated users (admins) can create practice users
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in as admin');
    }

    const { email, practiceId } = request.data as { email: string; practiceId: string };

    if (!email || !practiceId) {
      throw new HttpsError('invalid-argument', 'Email and practiceId are required');
    }

    try {
      // Create the auth account with a random temporary password
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const userRecord = await adminAuth.createUser({
        email,
        password: tempPassword,
        emailVerified: false,
      });

      // Link the auth UID to the practice document
      await db.collection('practices').doc(practiceId).update({
        auth_uid: userRecord.uid,
        contact_email: email,
      });

      // Generate password reset link so user can set their own password
      const resetLink = await adminAuth.generatePasswordResetLink(email);

      return {
        success: true,
        uid: userRecord.uid,
      };
    } catch (error) {
      console.error('Error creating practice user:', error);
      const message = error instanceof Error ? error.message : 'Failed to create user';
      throw new HttpsError('internal', message);
    }
  }
);

/**
 * Get the practice linked to the currently authenticated user.
 */
export const getMyPractice = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ found: boolean; practice?: Record<string, unknown>; practiceId?: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    try {
      const snapshot = await db.collection('practices')
        .where('auth_uid', '==', request.auth.uid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { found: false };
      }

      const practiceDoc = snapshot.docs[0];
      const data = practiceDoc.data();

      return {
        found: true,
        practiceId: practiceDoc.id,
        practice: {
          name: data.name,
          ods_code: data.ods_code,
          is_active: data.is_active,
          selected_medications: data.selected_medications || [],
        },
      };
    } catch (error) {
      console.error('Error getting practice:', error);
      throw new HttpsError('internal', 'Unable to load practice');
    }
  }
);

/**
 * Update which medication blocks a practice has selected.
 */
export const updatePracticeMedications = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { medications } = request.data as { medications: string[] };

    if (!Array.isArray(medications)) {
      throw new HttpsError('invalid-argument', 'medications must be an array');
    }

    try {
      // Find the practice linked to this user
      const snapshot = await db.collection('practices')
        .where('auth_uid', '==', request.auth.uid)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new HttpsError('not-found', 'No practice linked to this account');
      }

      await snapshot.docs[0].ref.update({
        selected_medications: medications,
        updated_at: Timestamp.now(),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Error updating medications:', error);
      throw new HttpsError('internal', 'Unable to update medications');
    }
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = onCall({ region: 'europe-west2' }, async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
