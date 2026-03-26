import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiKey = defineString('GEMINI_API_KEY', { default: '' });

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

    // TODO: Uncomment for production - restrict to nhs.net only
    // if (!email.toLowerCase().endsWith('@nhs.net')) {
    //   throw new HttpsError('invalid-argument', 'Only nhs.net email addresses are accepted');
    // }

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
 * Generate medication content using Gemini AI.
 */
export const generateMedicationContent = onCall(
  { region: 'europe-west2' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in as admin');
    }

    const { medicationName, type } = request.data as { medicationName: string; type: 'NEW' | 'REAUTH' | 'GENERAL' };

    if (!medicationName) {
      throw new HttpsError('invalid-argument', 'Medication name is required');
    }

    const key = geminiKey.value();
    if (!key) {
      throw new HttpsError('failed-precondition', 'Gemini API key not configured. Run: firebase functions:secrets:set GEMINI_API_KEY');
    }

    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const typeLabel = type === 'NEW' ? 'starting treatment' : type === 'REAUTH' ? 'annual reauthorisation review' : 'general information';

      const prompt = `You are a UK NHS clinical pharmacist. Generate patient-facing medication information for "${medicationName}" (${typeLabel}).

Return ONLY valid JSON with no markdown formatting, no code blocks, just the raw JSON object:
{
  "title": "Short title for the medication card",
  "description": "2-3 sentence patient-friendly description of the medication, what it does, and why it has been prescribed. Use plain English suitable for UK NHS patients.",
  "category": "The therapeutic category (e.g. Diabetes, Cardiovascular, Respiratory, Dermatology, Pain Management, etc.)",
  "keyInfo": ["3-5 key safety or usage points as short sentences. Include practical advice like when to take it, common side effects to watch for, and when to seek help."],
  "sickDaysNeeded": true or false - whether sick day rules apply (typically true for diabetes/kidney medications),
  "nhsLink": "The most relevant NHS.uk medicines page URL if you know it, or empty string"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Parse the JSON from the response, stripping any markdown code blocks
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned);

      return { success: true, content: parsed };
    } catch (error) {
      console.error('Error generating content:', error);
      const message = error instanceof Error ? error.message : 'AI generation failed';
      throw new HttpsError('internal', message);
    }
  }
);

/**
 * Save a custom medication to Firestore.
 */
export const saveMedication = onCall(
  { region: 'europe-west2' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in as admin');
    }

    const data = request.data as {
      title: string;
      description: string;
      badge: string;
      category: string;
      keyInfo: string[];
      nhsLink: string;
      trendLinks: { title: string; url: string }[];
      sickDaysNeeded: boolean;
    };

    if (!data.title || !data.description || !data.category) {
      throw new HttpsError('invalid-argument', 'Title, description, and category are required');
    }

    try {
      // Find next available code: query all custom medications, find max code
      const snapshot = await db.collection('medications').orderBy('code', 'desc').limit(1).get();
      let nextCode: string;

      if (snapshot.empty) {
        nextCode = '601';
      } else {
        const maxCode = parseInt(snapshot.docs[0].data().code, 10);
        // Next group: increment by 100 (601 -> 701 -> 801...)
        nextCode = String(Math.floor(maxCode / 100) * 100 + 100 + 1);
      }

      const medDoc = {
        code: nextCode,
        title: data.title,
        description: data.description,
        badge: data.badge || 'NEW',
        category: data.category,
        keyInfo: data.keyInfo || [],
        nhsLink: data.nhsLink || '',
        trendLinks: data.trendLinks || [],
        sickDaysNeeded: data.sickDaysNeeded || false,
        created_at: Timestamp.now(),
        created_by: request.auth.uid,
      };

      await db.collection('medications').doc(nextCode).set(medDoc);

      return { success: true, code: nextCode };
    } catch (error) {
      console.error('Error saving medication:', error);
      throw new HttpsError('internal', 'Failed to save medication');
    }
  }
);

/**
 * List all custom medications from Firestore.
 */
export const listMedications = onCall(
  { region: 'europe-west2' },
  async () => {
    try {
      const snapshot = await db.collection('medications').orderBy('code', 'asc').get();
      const medications = snapshot.docs.map(doc => doc.data());
      return { medications };
    } catch (error) {
      console.error('Error listing medications:', error);
      throw new HttpsError('internal', 'Failed to list medications');
    }
  }
);

/**
 * Delete a custom medication from Firestore.
 */
export const deleteMedication = onCall(
  { region: 'europe-west2' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in as admin');
    }

    const { code } = request.data as { code: string };
    if (!code) {
      throw new HttpsError('invalid-argument', 'Medication code is required');
    }

    try {
      await db.collection('medications').doc(code).delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw new HttpsError('internal', 'Failed to delete medication');
    }
  }
);

/**
 * Health check endpoint
 */
export const healthCheck = onCall({ region: 'europe-west2' }, async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiKeyLoaded: !!geminiKey.value()
  };
});
