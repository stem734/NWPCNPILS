import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';

const geminiKey = defineString('GEMINI_API_KEY', { default: '' });
const GEMINI_MODEL = 'gemini-2.5-flash';
const BUILT_IN_MAX_FAMILY = 5;

initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

type MedicationGenerationRequest = {
  medicationName: string;
  type: 'NEW' | 'REAUTH';
};

type MedicationGenerationResponse = {
  title: string;
  description: string;
  category: string;
  keyInfo: string[];
  nhsLink: string;
  trendLinks: { title: string; url: string }[];
  sickDaysNeeded: boolean;
};

type AdminRecord = {
  email: string;
  name: string;
  is_active: boolean;
  role: 'owner' | 'admin';
  created_at: Timestamp;
  updated_at: Timestamp;
};

const medicationGenerationSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: 'Short patient-friendly title for the medication card.',
    },
    description: {
      type: SchemaType.STRING,
      description: 'Two to three sentence patient-friendly overview.',
    },
    category: {
      type: SchemaType.STRING,
      description: 'Clinical category such as Diabetes, Dermatology, Cardiovascular.',
    },
    keyInfo: {
      type: SchemaType.ARRAY,
      description: 'Three to five short safety or usage points.',
      items: { type: SchemaType.STRING },
    },
    nhsLink: {
      type: SchemaType.STRING,
      description: 'An official NHS link if known, otherwise an empty string.',
    },
    trendLinks: {
      type: SchemaType.ARRAY,
      description: 'Optional supporting leaflet links. Use an empty array if unsure.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          url: { type: SchemaType.STRING },
        },
        required: ['title', 'url'],
      },
    },
    sickDaysNeeded: {
      type: SchemaType.BOOLEAN,
      description: 'True when this medication typically needs sick day rule advice.',
    },
  },
  required: ['title', 'description', 'category', 'keyInfo', 'nhsLink', 'trendLinks', 'sickDaysNeeded'],
};

const extractMedicationPayload = (raw: string): MedicationGenerationResponse => {
  const parsed = JSON.parse(raw) as Partial<MedicationGenerationResponse>;

  return {
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    category: typeof parsed.category === 'string' ? parsed.category.trim() : '',
    keyInfo: Array.isArray(parsed.keyInfo)
      ? parsed.keyInfo.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 5)
      : [],
    nhsLink: typeof parsed.nhsLink === 'string' ? parsed.nhsLink.trim() : '',
    trendLinks: Array.isArray(parsed.trendLinks)
      ? parsed.trendLinks
          .filter((item): item is { title: string; url: string } =>
            !!item &&
            typeof item.title === 'string' &&
            item.title.trim().length > 0 &&
            typeof item.url === 'string' &&
            item.url.trim().length > 0
          )
          .slice(0, 4)
      : [],
    sickDaysNeeded: Boolean(parsed.sickDaysNeeded),
  };
};

const assertAdmin = async (request: { auth?: { uid?: string; token?: { email?: string } } }): Promise<AdminRecord> => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be logged in as admin');
  }

  const adminRef = db.collection('admins').doc(request.auth.uid);
  const adminDoc = await adminRef.get();

  if (adminDoc.exists) {
    const adminData = adminDoc.data() as AdminRecord;
    if (!adminData.is_active) {
      throw new HttpsError('permission-denied', 'Administrator account is inactive');
    }
    return adminData;
  }

  const existingAdmins = await db.collection('admins').limit(1).get();
  if (!existingAdmins.empty) {
    throw new HttpsError('permission-denied', 'Administrator access required');
  }

  const authUser = await adminAuth.getUser(request.auth.uid);
  const now = Timestamp.now();
  const bootstrapAdmin: AdminRecord = {
    email: authUser.email || request.auth.token?.email || '',
    name: authUser.displayName || authUser.email || 'Primary Administrator',
    is_active: true,
    role: 'owner',
    created_at: now,
    updated_at: now,
  };

  await adminRef.set(bootstrapAdmin);
  return bootstrapAdmin;
};

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
        link_visit_count: FieldValue.increment(1),
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
    await assertAdmin(request);

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

export const listAdminUsers = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ admins: Array<Record<string, unknown>> }> => {
    await assertAdmin(request);

    try {
      const snapshot = await db.collection('admins').orderBy('email', 'asc').get();
      const admins = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      return { admins };
    } catch (error) {
      console.error('Error listing admins:', error);
      throw new HttpsError('internal', 'Unable to load administrators');
    }
  }
);

export const createAdminUser = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean; uid: string }> => {
    const actingAdmin = await assertAdmin(request);
    const { email, name } = request.data as { email: string; name?: string };

    if (!email || typeof email !== 'string') {
      throw new HttpsError('invalid-argument', 'Admin email is required');
    }

    try {
      const userRecord = await adminAuth.createUser({
        email: email.trim(),
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        emailVerified: false,
        displayName: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      });

      const now = Timestamp.now();
      await db.collection('admins').doc(userRecord.uid).set({
        email: email.trim(),
        name: typeof name === 'string' && name.trim() ? name.trim() : email.trim(),
        is_active: true,
        role: actingAdmin.role === 'owner' ? 'admin' : 'admin',
        created_at: now,
        updated_at: now,
      } satisfies AdminRecord);

      await adminAuth.generatePasswordResetLink(email.trim());

      return {
        success: true,
        uid: userRecord.uid,
      };
    } catch (error) {
      console.error('Error creating admin user:', error);
      const message = error instanceof Error ? error.message : 'Failed to create administrator';
      throw new HttpsError('internal', message);
    }
  }
);

export const updateAdminUser = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean }> => {
    const actingAdmin = await assertAdmin(request);
    const { uid, email, name, isActive } = request.data as {
      uid: string;
      email: string;
      name: string;
      isActive: boolean;
    };

    if (!uid || !email || !name) {
      throw new HttpsError('invalid-argument', 'uid, email, and name are required');
    }

    const adminRef = db.collection('admins').doc(uid);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) {
      throw new HttpsError('not-found', 'Administrator account not found');
    }

    const targetAdmin = adminDoc.data() as AdminRecord;
    if (targetAdmin.role === 'owner' && actingAdmin.role !== 'owner') {
      throw new HttpsError('permission-denied', 'Only the owner can modify the owner account');
    }

    try {
      await adminAuth.updateUser(uid, {
        email: email.trim(),
        displayName: name.trim(),
        disabled: !isActive,
      });

      await adminRef.update({
        email: email.trim(),
        name: name.trim(),
        is_active: Boolean(isActive),
        updated_at: Timestamp.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating admin user:', error);
      const message = error instanceof Error ? error.message : 'Failed to update administrator';
      throw new HttpsError('internal', message);
    }
  }
);

export const sendAdminPasswordReset = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean }> => {
    await assertAdmin(request);
    const { uid } = request.data as { uid: string };

    if (!uid) {
      throw new HttpsError('invalid-argument', 'Administrator uid is required');
    }

    try {
      const userRecord = await adminAuth.getUser(uid);
      if (!userRecord.email) {
        throw new HttpsError('failed-precondition', 'Administrator does not have an email address');
      }

      await adminAuth.generatePasswordResetLink(userRecord.email);
      return { success: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Error sending admin password reset:', error);
      const message = error instanceof Error ? error.message : 'Failed to send password reset';
      throw new HttpsError('internal', message);
    }
  }
);

export const deleteAdminUser = onCall(
  { region: 'europe-west2' },
  async (request): Promise<{ success: boolean }> => {
    const actingAdmin = await assertAdmin(request);
    const { uid } = request.data as { uid: string };

    if (!uid) {
      throw new HttpsError('invalid-argument', 'Administrator uid is required');
    }

    if (uid === request.auth?.uid) {
      throw new HttpsError('failed-precondition', 'You cannot delete your own administrator account');
    }

    const adminRef = db.collection('admins').doc(uid);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) {
      throw new HttpsError('not-found', 'Administrator account not found');
    }

    const targetAdmin = adminDoc.data() as AdminRecord;
    if (targetAdmin.role === 'owner' || actingAdmin.role !== 'owner') {
      throw new HttpsError('permission-denied', 'Only the owner can delete administrator accounts');
    }

    try {
      await adminAuth.deleteUser(uid);
      await adminRef.delete();
      return { success: true };
    } catch (error) {
      console.error('Error deleting admin user:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete administrator';
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
          link_visit_count: typeof data.link_visit_count === 'number' ? data.link_visit_count : 0,
          last_accessed_ms: data.last_accessed && typeof data.last_accessed.toMillis === 'function'
            ? data.last_accessed.toMillis()
            : null,
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
    await assertAdmin(request);

    if (!geminiKey.value()) {
      throw new HttpsError(
        'failed-precondition',
        'Gemini API key is not configured for Cloud Functions.'
      );
    }

    const { medicationName, type } = request.data as MedicationGenerationRequest;
    const medType = type === 'REAUTH' ? 'REAUTH' : 'NEW';

    if (!medicationName || typeof medicationName !== 'string') {
      throw new HttpsError('invalid-argument', 'Medication name is required');
    }

    try {
      const genAI = new GoogleGenerativeAI(geminiKey.value());
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
          responseSchema: medicationGenerationSchema,
        },
      });

      const prompt = `
You are generating concise NHS-style draft content for a clinician-admin medication information card.

Medication name: ${medicationName.trim()}
Card type: ${medType === 'NEW' ? 'Starting treatment' : 'Yearly reauthorisation review'}

Rules:
- Return JSON only.
- Make the content suitable for UK patients in plain English.
- title should include the medication name and whether it is starting treatment or reauthorisation.
- description should be 2 to 3 short sentences.
- keyInfo should contain 3 to 5 short bullet-style points.
- If you are not confident of an NHS URL, set nhsLink to an empty string.
- If you are not confident of extra leaflet URLs, return trendLinks as an empty array.
- sickDaysNeeded should be true only when sick day rule advice is commonly relevant.
`;

      const result = await model.generateContent(prompt);
      const content = extractMedicationPayload(result.response.text());

      if (!content.title || !content.description || !content.category || content.keyInfo.length === 0) {
        throw new Error('Incomplete AI response');
      }

      return {
        success: true,
        content,
      };
    } catch (error) {
      console.error('Error generating medication content:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate medication content';
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
    await assertAdmin(request);
    const actorUid = request.auth?.uid;

    const data = request.data as {
      code?: string;
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
      const badge = data.badge === 'REAUTH' ? 'REAUTH' : 'NEW';
      const requestedCode = typeof data.code === 'string' ? data.code.trim() : '';

      let medicationCode = requestedCode;

      if (!medicationCode) {
        // Allocate the next custom family in x01 / x02 format, where
        // x01 = starting treatment and x02 = yearly reauthorisation.
        const snapshot = await db.collection('medications').get();
        const highestFamilyInFirestore = snapshot.docs.reduce((maxFamily, doc) => {
          const docCode = doc.data().code;
          const parsedCode = Number.parseInt(typeof docCode === 'string' ? docCode : '', 10);

          if (Number.isNaN(parsedCode)) {
            return maxFamily;
          }

          return Math.max(maxFamily, Math.floor(parsedCode / 100));
        }, BUILT_IN_MAX_FAMILY);

        const nextFamily = highestFamilyInFirestore + 1;
        medicationCode = String(nextFamily * 100 + (badge === 'REAUTH' ? 2 : 1));
      }

      if (!actorUid) {
        throw new HttpsError('unauthenticated', 'Must be logged in as admin');
      }

      const medDoc = {
        code: medicationCode,
        title: data.title,
        description: data.description,
        badge,
        category: data.category,
        keyInfo: data.keyInfo || [],
        nhsLink: data.nhsLink || '',
        trendLinks: data.trendLinks || [],
        sickDaysNeeded: data.sickDaysNeeded || false,
        is_deleted: false,
        updated_at: Timestamp.now(),
        updated_by: actorUid,
      };

      const medicationRef = db.collection('medications').doc(medicationCode);
      const existingDoc = await medicationRef.get();

      await medicationRef.set({
        ...medDoc,
        created_at: existingDoc.exists ? existingDoc.data()?.created_at || Timestamp.now() : Timestamp.now(),
        created_by: existingDoc.exists ? existingDoc.data()?.created_by || actorUid : actorUid,
      }, { merge: true });

      return { success: true, code: medicationCode };
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
      const medications = snapshot.docs
        .map(doc => doc.data())
        .filter((medication) => !medication.is_deleted);
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
    await assertAdmin(request);
    const actorUid = request.auth?.uid;

    const { code } = request.data as { code: string };
    if (!code) {
      throw new HttpsError('invalid-argument', 'Medication code is required');
    }
    if (!actorUid) {
      throw new HttpsError('unauthenticated', 'Must be logged in as admin');
    }

    try {
      await db.collection('medications').doc(code).set({
        code,
        is_deleted: true,
        deleted_at: Timestamp.now(),
        deleted_by: actorUid,
      }, { merge: true });
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
    apiKeyLoaded: true // MVP: Not checking Gemini key
  };
});
