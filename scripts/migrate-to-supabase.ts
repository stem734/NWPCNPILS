/**
 * Firebase to Supabase data migration script.
 *
 * Prerequisites:
 * 1. Place the Firebase service account key at `scripts/firebase-service-account.json`
 * 2. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_KEY
 * 3. Run `supabase/schema.sql`, `supabase/rls.sql`, and `supabase/rpc.sql`
 * 4. Install dependencies: `npm install firebase-admin @supabase/supabase-js`
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 *
 * Notes:
 * - This script expects a fresh or mostly empty Supabase auth user set.
 * - Legacy `selected_medications` values are copied onto `practices` only for
 *   migration support. They are not converted into active practice cards.
 * - Global admins and practice-linked users are merged into the unified `users`
 *   table, and practice memberships are backfilled separately.
 */

import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

const serviceAccountPath = resolve(__dirname, 'firebase-service-account.json');
let serviceAccount: ServiceAccount;

try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
} catch {
  console.error(`Cannot read Firebase service account key at ${serviceAccountPath}`);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const firestore = getFirestore();
const firebaseAuth = getAuth();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type FirebaseUserSummary = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
};

type PracticeAuthLink = {
  firebaseUid: string;
  firestorePracticeId: string;
  practiceName: string;
  signedUpAt: string | null;
};

const uidMap = new Map<string, string>();
const practiceIdMap = new Map<string, string>();
const firebaseUsersByUid = new Map<string, FirebaseUserSummary>();
const practiceAuthLinks: PracticeAuthLink[] = [];

const toIso = (ts: Timestamp | null | undefined): string | null => {
  if (!ts || typeof ts.toDate !== 'function') {
    return null;
  }

  return ts.toDate().toISOString();
};

const toSafeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const getFirebaseUserSummary = (user: UserRecord): FirebaseUserSummary => ({
  uid: user.uid,
  email: user.email?.trim() || '',
  displayName: user.displayName?.trim() || '',
  disabled: Boolean(user.disabled),
});

async function listAllFirebaseUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const result = await firebaseAuth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return users;
}

async function migrateAuthUsers() {
  console.log('\n=== Step 1: Migrating Auth Users ===');

  const firebaseUsers = await listAllFirebaseUsers();
  console.log(`  Found ${firebaseUsers.length} Firebase Auth users`);

  let migrated = 0;
  let reusedMappings = 0;

  for (const fbUser of firebaseUsers) {
    firebaseUsersByUid.set(fbUser.uid, getFirebaseUserSummary(fbUser));

    if (!fbUser.email) {
      console.warn(`  - Skipping ${fbUser.uid}: no email address`);
      continue;
    }

    const { data: existingMapping, error: mappingError } = await supabase
      .from('firebase_uid_map')
      .select('supabase_uid')
      .eq('firebase_uid', fbUser.uid)
      .maybeSingle();

    if (mappingError) {
      console.error(`  x Failed to check UID mapping for ${fbUser.email}: ${mappingError.message}`);
      continue;
    }

    if (existingMapping?.supabase_uid) {
      uidMap.set(fbUser.uid, existingMapping.supabase_uid);
      reusedMappings++;
      console.log(`  = Reused mapping for ${fbUser.email}`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: fbUser.email,
      email_confirm: true,
      user_metadata: {
        firebase_uid: fbUser.uid,
        display_name: fbUser.displayName || '',
      },
    });

    if (error || !data.user) {
      console.error(`  x Failed to create user ${fbUser.email}: ${error?.message || 'Unknown error'}`);
      continue;
    }

    const supabaseUid = data.user.id;
    uidMap.set(fbUser.uid, supabaseUid);

    const { error: insertMappingError } = await supabase.from('firebase_uid_map').insert({
      firebase_uid: fbUser.uid,
      supabase_uid: supabaseUid,
    });

    if (insertMappingError) {
      console.error(`  x Failed to store UID mapping for ${fbUser.email}: ${insertMappingError.message}`);
      continue;
    }

    migrated++;
    console.log(`  + ${fbUser.email} (${fbUser.uid} -> ${supabaseUid})`);
  }

  console.log(`  Migrated ${migrated} users and reused ${reusedMappings} mappings`);
}

async function migrateUsersWithGlobalAdminAccess() {
  console.log('\n=== Step 2: Migrating Users With Global Admin Access ===');

  const snapshot = await firestore.collection('admins').get();
  console.log(`  Found ${snapshot.size} admin documents`);

  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const supabaseUid = uidMap.get(doc.id);
    const firebaseUser = firebaseUsersByUid.get(doc.id);

    if (!supabaseUid) {
      console.error(`  x No Supabase UID mapping for admin ${doc.id}`);
      continue;
    }

    const { error } = await supabase.from('users').upsert({
      uid: supabaseUid,
      email: toSafeString(data.email) || firebaseUser?.email || '',
      name: toSafeString(data.name) || firebaseUser?.displayName || toSafeString(data.email) || firebaseUser?.email || 'Administrator',
      is_active: Boolean(data.is_active ?? true) && !(firebaseUser?.disabled ?? false),
      global_role: data.role === 'owner' ? 'owner' : 'admin',
      created_at: toIso(data.created_at) || new Date().toISOString(),
      updated_at: toIso(data.updated_at) || new Date().toISOString(),
    });

    if (error) {
      console.error(`  x Failed to insert admin ${data.email}: ${error.message}`);
      continue;
    }

    migrated++;
    console.log(`  + ${toSafeString(data.email)} (${data.role || 'admin'})`);
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} global admin users`);
}

async function migrateMedications() {
  console.log('\n=== Step 3: Migrating Medications ===');

  const snapshot = await firestore.collection('medications').get();
  console.log(`  Found ${snapshot.size} medication documents`);

  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    const { error } = await supabase.from('medications').upsert({
      code: doc.id,
      title: toSafeString(data.title),
      description: toSafeString(data.description),
      badge: data.badge === 'REAUTH' ? 'REAUTH' : data.badge === 'GENERAL' ? 'GENERAL' : 'NEW',
      category: toSafeString(data.category),
      key_info: Array.isArray(data.keyInfo) ? data.keyInfo : [],
      nhs_link: toSafeString(data.nhsLink),
      trend_links: Array.isArray(data.trendLinks) ? data.trendLinks : [],
      sick_days_needed: Boolean(data.sickDaysNeeded),
      review_months: typeof data.reviewMonths === 'number' ? data.reviewMonths : 12,
      content_review_date: toSafeString(data.contentReviewDate),
      is_deleted: Boolean(data.is_deleted),
      created_at: toIso(data.created_at),
      created_by: data.created_by ? uidMap.get(data.created_by) || null : null,
      updated_at: toIso(data.updated_at),
      updated_by: data.updated_by ? uidMap.get(data.updated_by) || null : null,
      deleted_at: toIso(data.deleted_at),
      deleted_by: data.deleted_by ? uidMap.get(data.deleted_by) || null : null,
    });

    if (error) {
      console.error(`  x Failed to insert medication ${doc.id}: ${error.message}`);
      continue;
    }

    migrated++;
    console.log(`  + ${doc.id} - ${toSafeString(data.title)}`);
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} medications`);
}

async function migratePractices() {
  console.log('\n=== Step 4: Migrating Practices ===');

  const snapshot = await firestore.collection('practices').get();
  console.log(`  Found ${snapshot.size} practice documents`);

  let migrated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const firebasePracticeUid = toSafeString(data.auth_uid);
    const supabasePracticeUid = firebasePracticeUid ? uidMap.get(firebasePracticeUid) || null : null;

    const { data: inserted, error } = await supabase
      .from('practices')
      .insert({
        name: toSafeString(data.name),
        name_lowercase: toSafeString(data.name_lowercase) || toSafeString(data.name).toLowerCase(),
        ods_code: toSafeString(data.ods_code) || null,
        contact_email: toSafeString(data.contact_email) || null,
        contact_name: toSafeString(data.contact_name) || null,
        is_active: Boolean(data.is_active),
        auth_uid: supabasePracticeUid,
        selected_medications: Array.isArray(data.selected_medications) ? data.selected_medications : [],
        medication_review_dates:
          data.medication_review_dates && typeof data.medication_review_dates === 'object'
            ? data.medication_review_dates
            : {},
        link_visit_count: typeof data.link_visit_count === 'number' ? data.link_visit_count : 0,
        patient_rating_count: typeof data.patient_rating_count === 'number' ? data.patient_rating_count : 0,
        patient_rating_total: typeof data.patient_rating_total === 'number' ? data.patient_rating_total : 0,
        last_accessed: toIso(data.last_accessed),
        signed_up_at: toIso(data.signed_up_at),
        updated_at: toIso(data.updated_at),
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error(`  x Failed to insert practice ${data.name}: ${error?.message || 'Unknown error'}`);
      continue;
    }

    practiceIdMap.set(doc.id, inserted.id);

    if (firebasePracticeUid) {
      practiceAuthLinks.push({
        firebaseUid: firebasePracticeUid,
        firestorePracticeId: doc.id,
        practiceName: toSafeString(data.name),
        signedUpAt: toIso(data.signed_up_at),
      });
    }

    migrated++;
    console.log(`  + ${toSafeString(data.name)} (${doc.id} -> ${inserted.id})`);
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} practices`);
}

async function migratePracticeAccess() {
  console.log('\n=== Step 5: Migrating Practice Access ===');

  const linksByFirebaseUid = new Map<string, PracticeAuthLink[]>();

  for (const link of practiceAuthLinks) {
    const existing = linksByFirebaseUid.get(link.firebaseUid) || [];
    existing.push(link);
    linksByFirebaseUid.set(link.firebaseUid, existing);
  }

  let usersUpserted = 0;
  let membershipsMigrated = 0;

  for (const [firebaseUid, links] of linksByFirebaseUid.entries()) {
    const supabaseUid = uidMap.get(firebaseUid);
    if (!supabaseUid) {
      console.error(`  x No Supabase UID mapping for practice user ${firebaseUid}`);
      continue;
    }

    const firebaseUser = firebaseUsersByUid.get(firebaseUid);
    const primaryLink = [...links].sort((left, right) =>
      (left.signedUpAt || '').localeCompare(right.signedUpAt || '') || left.practiceName.localeCompare(right.practiceName),
    )[0];

    const fallbackEmail = firebaseUser?.email || '';
    const fallbackName =
      firebaseUser?.displayName ||
      fallbackEmail ||
      primaryLink.practiceName ||
      'Practice user';

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('email, name, is_active, global_role, created_at')
      .eq('uid', supabaseUid)
      .maybeSingle();

    if (existingUserError) {
      console.error(`  x Failed to inspect existing user ${fallbackEmail || firebaseUid}: ${existingUserError.message}`);
      continue;
    }

    const { error: practiceUserError } = await supabase.from('users').upsert({
      uid: supabaseUid,
      email: existingUser?.email || fallbackEmail,
      name: existingUser?.name || fallbackName,
      is_active: Boolean(existingUser?.is_active ?? true) && !(firebaseUser?.disabled ?? false),
      global_role: existingUser?.global_role || null,
      created_at: existingUser?.created_at || primaryLink.signedUpAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (practiceUserError) {
      console.error(`  x Failed to upsert user ${fallbackEmail || firebaseUid}: ${practiceUserError.message}`);
      continue;
    }

    usersUpserted++;

    const sortedLinks = [...links].sort((left, right) =>
      (left.signedUpAt || '').localeCompare(right.signedUpAt || '') || left.practiceName.localeCompare(right.practiceName),
    );

    const membershipPayload = sortedLinks
      .map((link, index) => {
        const practiceId = practiceIdMap.get(link.firestorePracticeId);
        if (!practiceId) {
          console.error(`  x Missing practice mapping for ${link.practiceName}`);
          return null;
        }

        return {
          practice_id: practiceId,
          user_uid: supabaseUid,
          role: 'admin',
          is_default: index === 0,
          created_at: link.signedUpAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const { error: clearDefaultError } = await supabase
      .from('practice_memberships')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('user_uid', supabaseUid);

    if (clearDefaultError) {
      console.error(`  x Failed to clear default memberships for ${fallbackEmail || firebaseUid}: ${clearDefaultError.message}`);
      continue;
    }

    if (membershipPayload.length === 0) {
      continue;
    }

    const { error: membershipError } = await supabase
      .from('practice_memberships')
      .upsert(membershipPayload, { onConflict: 'practice_id,user_uid' });

    if (membershipError) {
      console.error(`  x Failed to upsert memberships for ${fallbackEmail || firebaseUid}: ${membershipError.message}`);
      continue;
    }

    membershipsMigrated += membershipPayload.length;
    console.log(`  + ${fallbackEmail || firebaseUid} linked to ${membershipPayload.length} practice(s)`);
  }

  console.log(`  Migrated ${usersUpserted} practice-linked users and ${membershipsMigrated} memberships`);
}

async function migrateLoginAudit() {
  console.log('\n=== Step 6: Migrating Login Audit ===');

  const snapshot = await firestore.collection('login_audit').get();
  console.log(`  Found ${snapshot.size} login audit documents`);

  const batch: Record<string, unknown>[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    batch.push({
      uid: data.uid ? uidMap.get(data.uid) || null : null,
      email: toSafeString(data.email) || null,
      actor_type: data.actorType === 'admin' ? 'admin' : 'practice',
      actor_name: toSafeString(data.actorName) || null,
      actor_id: data.actorId ? practiceIdMap.get(data.actorId) || data.actorId : null,
      admin_role: data.adminRole === 'owner' ? 'owner' : data.adminRole === 'admin' ? 'admin' : null,
      portal: data.portal === 'admin' ? 'admin' : 'practice',
      user_agent: toSafeString(data.userAgent),
      ip_address: toSafeString(data.ipAddress),
      created_at: toIso(data.created_at),
    });
  }

  let migrated = 0;

  for (let index = 0; index < batch.length; index += 100) {
    const chunk = batch.slice(index, index + 100);
    const { error } = await supabase.from('login_audit').insert(chunk);

    if (error) {
      console.error(`  x Failed to insert login audit chunk at ${index}: ${error.message}`);
      continue;
    }

    migrated += chunk.length;
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} login audit entries`);
}

async function migrateAuditLog() {
  console.log('\n=== Step 7: Migrating Audit Log ===');

  const snapshot = await firestore.collection('audit_log').get();
  console.log(`  Found ${snapshot.size} audit log documents`);

  const batch: Record<string, unknown>[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    batch.push({
      action: data.action,
      actor_uid: data.actorUid ? uidMap.get(data.actorUid) || null : null,
      code: toSafeString(data.code) || null,
      timestamp: toIso(data.timestamp),
      previous_state: data.previous_state || null,
      new_state: data.new_state || null,
    });
  }

  let migrated = 0;

  for (let index = 0; index < batch.length; index += 100) {
    const chunk = batch.slice(index, index + 100);
    const { error } = await supabase.from('audit_log').insert(chunk);

    if (error) {
      console.error(`  x Failed to insert audit log chunk at ${index}: ${error.message}`);
      continue;
    }

    migrated += chunk.length;
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} audit log entries`);
}

async function verifyCounts() {
  console.log('\n=== Verification: Row Counts ===');

  const practicesSnapshot = await firestore.collection('practices').get();
  const adminSnapshot = await firestore.collection('admins').get();
  const linkedPracticeCount = practicesSnapshot.docs.filter((doc) => toSafeString(doc.data().auth_uid)).length;
  const uniquePracticeUserIds = new Set(
    practicesSnapshot.docs
      .map((doc) => toSafeString(doc.data().auth_uid))
      .filter(Boolean),
  );
  const uniqueGlobalAdminIds = new Set(adminSnapshot.docs.map((doc) => doc.id));
  const unifiedUserCount = new Set([
    ...uniquePracticeUserIds,
    ...uniqueGlobalAdminIds,
  ]).size;

  const firestoreCounts = new Map<string, number>([
    ['users', unifiedUserCount],
    ['medications', (await firestore.collection('medications').get()).size],
    ['practices', practicesSnapshot.size],
    ['practice_memberships', linkedPracticeCount],
    ['login_audit', (await firestore.collection('login_audit').get()).size],
    ['audit_log', (await firestore.collection('audit_log').get()).size],
  ]);

  for (const table of firestoreCounts.keys()) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const firestoreCount = firestoreCounts.get(table) || 0;
    const match = firestoreCount === count ? '+' : 'x MISMATCH';
    console.log(`  ${match} ${table}: Firestore=${firestoreCount} Supabase=${count}`);
  }
}

async function main() {
  console.log('==========================================');
  console.log(' Firebase to Supabase Migration');
  console.log('==========================================');

  await migrateAuthUsers();
  await migrateUsersWithGlobalAdminAccess();
  await migrateMedications();
  await migratePractices();
  await migratePracticeAccess();
  await migrateLoginAudit();
  await migrateAuditLog();
  await verifyCounts();

  console.log('\nMigration complete.');
  console.log('All users will need to set or reset their passwords in Supabase Auth.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
