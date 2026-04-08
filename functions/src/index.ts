import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';
import { Resend } from 'resend';

const geminiKey = defineString('GEMINI_API_KEY', { default: '' });
const resendApiKey = defineString('RESEND_API_KEY', { default: '' });
const resendFromEmail = defineString('RESEND_FROM_EMAIL', { default: '' });
const appBaseUrl = defineString('APP_BASE_URL', { default: 'https://mymedinfo.vercel.app' });
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

const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const normaliseMedicationFamilyName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(starting treatment|reauthorisation|first initiation|annual review|review)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  let parsed: Partial<MedicationGenerationResponse>;
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    parsed = JSON.parse(cleaned);
  } catch (err) {
    try {
      // Fallback: strip all newlines which often cause unterminated string errors in generated JSON
      const singleLine = raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').replace(/\n/g, ' ');
      parsed = JSON.parse(singleLine);
    } catch (fallbackErr) {
      console.error('Failed to parse AI JSON:', raw);
      throw new Error(`AI response was likely truncated. Please try again. (Details: ${err instanceof Error ? err.message : 'Parse error'})`);
    }
  }

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

const getAdminActionCodeSettings = () => ({
  url: `${appBaseUrl.value().replace(/\/$/, '')}/admin`,
  handleCodeInApp: false,
});

const sendTransactionalEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  if (!resendApiKey.value() || !resendFromEmail.value()) {
    throw new HttpsError(
      'failed-precondition',
      'Transactional email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to functions/.env.',
    );
  }

  const resend = new Resend(resendApiKey.value());
  await resend.emails.send({
    from: resendFromEmail.value(),
    to,
    subject,
    html,
    text,
  });
};

const sendAdminWelcomeEmail = async ({
  email,
  name,
  resetLink,
}: {
  email: string;
  name: string;
  resetLink: string;
}) => {
  await sendTransactionalEmail({
    to: email,
    subject: 'Set up your MyMedInfo administrator account',
    text: `Hello ${name},\n\nYour MyMedInfo administrator account has been created. Set your password using this secure link:\n${resetLink}\n\nAfter setting your password, sign in at ${appBaseUrl.value().replace(/\/$/, '')}/admin\n`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #212b32;">
        <h2 style="color: #005eb8;">Welcome to MyMedInfo</h2>
        <p>Hello ${name},</p>
        <p>Your MyMedInfo administrator account has been created. Use the button below to set your password.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background: #005eb8; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">Set Your Password</a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>After setting your password, sign in at <a href="${appBaseUrl.value().replace(/\/$/, '')}/admin">${appBaseUrl.value().replace(/\/$/, '')}/admin</a>.</p>
      </div>
    `,
  });
};

const sendAdminPasswordResetEmail = async ({
  email,
  name,
  resetLink,
}: {
  email: string;
  name: string;
  resetLink: string;
}) => {
  await sendTransactionalEmail({
    to: email,
    subject: 'Reset your MyMedInfo administrator password',
    text: `Hello ${name},\n\nUse this secure link to reset your MyMedInfo administrator password:\n${resetLink}\n\nIf you did not request this, you can ignore this email.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #212b32;">
        <h2 style="color: #005eb8;">Reset your MyMedInfo password</h2>
        <p>Hello ${name},</p>
        <p>Use the button below to reset your MyMedInfo administrator password.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background: #005eb8; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">Reset Password</a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
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
 * Submit a patient rating for a practice.
 */
export const submitPatientRating = onCall(
  { region: 'europe-west2', maxInstances: 100 },
  async (request): Promise<{ success: boolean; error?: string }> => {
    const { orgName, rating } = request.data as { orgName: string; rating: number };

    if (!orgName || typeof orgName !== 'string') {
      throw new HttpsError('invalid-argument', 'Organisation name is required');
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      throw new HttpsError('invalid-argument', 'Rating must be a number between 1 and 5');
    }

    try {
      const practicesRef = db.collection('practices');
      const snapshot = await practicesRef
        .where('name_lowercase', '==', orgName.toLowerCase().trim())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { success: false, error: 'Practice not found' };
      }

      await snapshot.docs[0].ref.update({
        patient_rating_count: FieldValue.increment(1),
        patient_rating_total: FieldValue.increment(rating),
      });

      return { success: true };
    } catch (error) {
      console.error('Error submitting rating:', error);
      throw new HttpsError('internal', 'Unable to submit rating');
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
  async (request): Promise<{ success: boolean; uid: string; resetLink: string }> => {
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

      const resetLink = await adminAuth.generatePasswordResetLink(email.trim(), getAdminActionCodeSettings());

      return {
        success: true,
        uid: userRecord.uid,
        resetLink,
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
  async (request): Promise<{ success: boolean; resetLink: string }> => {
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

      const resetLink = await adminAuth.generatePasswordResetLink(userRecord.email, getAdminActionCodeSettings());
      return { success: true, resetLink };
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
          medication_review_dates: data.medication_review_dates || {},
          link_visit_count: typeof data.link_visit_count === 'number' ? data.link_visit_count : 0,
          patient_rating_count: typeof data.patient_rating_count === 'number' ? data.patient_rating_count : 0,
          patient_rating_total: typeof data.patient_rating_total === 'number' ? data.patient_rating_total : 0,
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
  async (request): Promise<{ success: boolean; medicationReviewDates: Record<string, string> }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { medications, medicationReviewDates } = request.data as {
      medications: string[];
      medicationReviewDates?: Record<string, string>;
    };

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

      const practiceDoc = snapshot.docs[0];
      const existingData = practiceDoc.data();
      const existingReviewDates = existingData.medication_review_dates && typeof existingData.medication_review_dates === 'object'
        ? existingData.medication_review_dates as Record<string, string>
        : {};

      const nextReviewDates = medications.reduce<Record<string, string>>((acc, code) => {
        const requestedDate = medicationReviewDates?.[code];
        const existingDate = existingReviewDates[code];
        const fallbackDate = toDateKey(addMonths(new Date(), 12));
        acc[code] = typeof requestedDate === 'string' && requestedDate.trim() ? requestedDate : existingDate || fallbackDate;
        return acc;
      }, {});

      await snapshot.docs[0].ref.update({
        selected_medications: medications,
        medication_review_dates: nextReviewDates,
        updated_at: Timestamp.now(),
      });

      return { success: true, medicationReviewDates: nextReviewDates };
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
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: medicationGenerationSchema,
        },
      });

      const prompt = `
You are generating concise NHS-style draft content for a clinician-admin medication information card.

Medication name: ${medicationName.trim()}
Card type: ${medType === 'NEW' ? 'Starting treatment' : 'Yearly reauthorisation review'}

Rules:
- Return JSON only. Ensure the output is strictly valid and well-formed JSON.
- Do NOT use unescaped newlines or line breaks inside string values.
- Make the content suitable for UK patients in plain English.
- Aim for an average UK reading age of about 9 to 11 years old.
- Use short sentences, everyday words, and short paragraphs.
- Avoid jargon and technical terms where possible. If a medical term is useful, explain it in simpler words.
- Prefer the plain English term first, then the medical term only if it helps understanding.
- title should include the medication name and whether it is starting treatment or reauthorisation.
- Keep the title clean and concise. Do not repeat example medicines or suffix explanations in the title.
- Do not include internal codes or admin-only terminology in the title or description.
- If the medication is a drug family or class rather than a single brand or generic medicine, make the title more recognisable with patient-friendly wording, but keep examples out of the title.
- Put recognisable examples or naming patterns in the description only, for example "such as gliclazide or glimepiride" or "many names end in -gliflozin".
- Prefer patient-friendly wording over abstract class labels on their own.
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
      requestedCode?: string;
      medicationName?: string;
      title: string;
      description: string;
      badge: string;
      category: string;
      keyInfo: string[];
      nhsLink: string;
      trendLinks: { title: string; url: string }[];
      sickDaysNeeded: boolean;
      contentReviewDate?: string;
    };

    if (!data.title || !data.description || !data.category) {
      throw new HttpsError('invalid-argument', 'Title, description, and category are required');
    }

    try {
      const badge = data.badge === 'REAUTH' ? 'REAUTH' : 'NEW';
      const existingCode = typeof data.code === 'string' ? data.code.trim() : '';
      const requestedCode = typeof data.requestedCode === 'string' ? data.requestedCode.trim() : '';
      const familyName = normaliseMedicationFamilyName(
        typeof data.medicationName === 'string' && data.medicationName.trim()
          ? data.medicationName
          : data.title,
      );

      let medicationCode = existingCode;

      if (!medicationCode) {
        const snapshot = await db.collection('medications').get();
        const matchingFamilyCode = snapshot.docs.find((doc) => {
          const docData = doc.data();
          const docTitle = typeof docData.title === 'string' ? docData.title : '';
          const docCode = typeof docData.code === 'string' ? docData.code : '';
          const docFamilyName = normaliseMedicationFamilyName(docTitle);

          if (!docCode || !docFamilyName || docFamilyName !== familyName) {
            return false;
          }

          return badge === 'REAUTH' ? docCode.endsWith('01') : docCode.endsWith('02');
        })?.data().code;

        if (typeof matchingFamilyCode === 'string' && matchingFamilyCode.length >= 3) {
          const familyBase = Number.parseInt(matchingFamilyCode.slice(0, -2), 10);
          if (!Number.isNaN(familyBase)) {
            medicationCode = String(familyBase * 100 + (badge === 'REAUTH' ? 2 : 1));
          }
        }

        if (!medicationCode && requestedCode) {
          medicationCode = requestedCode;
        }

        if (!medicationCode) {
          // Allocate the next custom family in x01 / x02 format, where
          // x01 = starting treatment and x02 = yearly reauthorisation.
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
      }

      if (requestedCode) {
        medicationCode = requestedCode;
      }

      if (requestedCode && requestedCode !== existingCode) {
        const requestedCodeDoc = await db.collection('medications').doc(requestedCode).get();
        if (requestedCodeDoc.exists) {
          throw new HttpsError('already-exists', `Code ${requestedCode} is already in use`);
        }
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
        contentReviewDate: data.contentReviewDate || '',
        is_deleted: false,
        updated_at: Timestamp.now(),
        updated_by: actorUid,
      };

      const medicationRef = db.collection('medications').doc(medicationCode);
      const existingDoc = await medicationRef.get();

      const action = existingDoc.exists ? 'updated' : 'created';
      
      const finalDoc = {
        ...medDoc,
        created_at: existingDoc.exists ? existingDoc.data()?.created_at || Timestamp.now() : Timestamp.now(),
        created_by: existingDoc.exists ? existingDoc.data()?.created_by || actorUid : actorUid,
      };

      await medicationRef.set(finalDoc, { merge: true });

      // Basic Audit System
      await db.collection('audit_log').add({
        action,
        actorUid,
        code: medicationCode,
        timestamp: Timestamp.now(),
        previous_state: existingDoc.exists ? existingDoc.data() : null,
        new_state: finalDoc,
      });

      if (existingCode && requestedCode && requestedCode !== existingCode) {
        await db.collection('medications').doc(existingCode).delete();
      }

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
      const medicationRef = db.collection('medications').doc(code);
      const existingDoc = await medicationRef.get();
      
      const updateData = {
        code,
        is_deleted: true,
        deleted_at: Timestamp.now(),
        deleted_by: actorUid,
      };
      
      await medicationRef.set(updateData, { merge: true });

      // Basic Audit System
      await db.collection('audit_log').add({
        action: 'deleted',
        actorUid,
        code,
        timestamp: Timestamp.now(),
        previous_state: existingDoc.exists ? existingDoc.data() : null,
        new_state: updateData,
      });

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

/**
 * List recent medication audit logs
 */
export const listMedicationAudits = onCall(
  { region: 'europe-west2' },
  async (request) => {
    await assertAdmin(request);
    try {
      const snapshot = await db.collection('audit_log')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const audits = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestampMs: data.timestamp ? data.timestamp.toMillis() : Date.now(),
        };
      });
      
      return { audits };
    } catch (error) {
      console.error('Error listing audits:', error);
      throw new HttpsError('internal', 'Failed to list audit logs');
    }
  }
);
