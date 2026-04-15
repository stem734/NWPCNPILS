/**
 * Firebase → Supabase Data Migration Script
 *
 * Prerequisites:
 *   1. Place your Firebase service account key at ./firebase-service-account.json
 *   2. Set environment variables:
 *      - SUPABASE_URL        (e.g. https://xxx.supabase.co)
 *      - SUPABASE_SERVICE_KEY (service role key, NOT the anon key)
 *   3. Run the Supabase SQL files first (schema.sql, rls.sql, rpc.sql)
 *   4. Install dependencies: npm install firebase-admin @supabase/supabase-js
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ─────────────────────────────────────────────────────────────

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

// ─── Initialise clients ────────────────────────────────────────────────────────

initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();
const firebaseAuth = getAuth();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toIso = (ts: Timestamp | null | undefined): string | null => {
  if (!ts || typeof ts.toDate !== 'function') return null;
  return ts.toDate().toISOString();
};

const uidMap = new Map<string, string>(); // firebase UID → supabase UUID
const practiceIdMap = new Map<string, string>(); // firestore doc ID → supabase UUID

// ─── Step 1: Migrate Auth Users ────────────────────────────────────────────────

async function migrateAuthUsers() {
  console.log('\n═══ Step 1: Migrating Auth Users ═══');

  const listResult = await firebaseAuth.listUsers();
  console.log(`  Found ${listResult.users.length} Firebase Auth users`);

  for (const fbUser of listResult.users) {
    // Create user in Supabase without a password (they will need to reset)
    const { data, error } = await supabase.auth.admin.createUser({
      email: fbUser.email!,
      email_confirm: true,
      user_metadata: {
        firebase_uid: fbUser.uid,
        display_name: fbUser.displayName || '',
      },
    });

    if (error) {
      console.error(`  ✗ Failed to create user ${fbUser.email}: ${error.message}`);
      continue;
    }

    const supabaseUid = data.user.id;
    uidMap.set(fbUser.uid, supabaseUid);

    // Record mapping in database
    await supabase.from('firebase_uid_map').insert({
      firebase_uid: fbUser.uid,
      supabase_uid: supabaseUid,
    });

    console.log(`  ✓ ${fbUser.email}  (${fbUser.uid} → ${supabaseUid})`);
  }

  console.log(`  Migrated ${uidMap.size} / ${listResult.users.length} users`);
}

// ─── Step 2: Migrate Admins ────────────────────────────────────────────────────

async function migrateAdmins() {
  console.log('\n═══ Step 2: Migrating Admins ═══');

  const snapshot = await firestore.collection('admins').get();
  console.log(`  Found ${snapshot.size} admin documents`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const supabaseUid = uidMap.get(doc.id);

    if (!supabaseUid) {
      console.error(`  ✗ No Supabase UID mapping for admin ${doc.id} (${d.email})`);
      continue;
    }

    const { error } = await supabase.from('admins').insert({
      uid: supabaseUid,
      email: d.email,
      name: d.name,
      is_active: d.is_active,
      role: d.role,
      created_at: toIso(d.created_at) || new Date().toISOString(),
      updated_at: toIso(d.updated_at) || new Date().toISOString(),
    });

    if (error) {
      console.error(`  ✗ Failed to insert admin ${d.email}: ${error.message}`);
    } else {
      migrated++;
      console.log(`  ✓ ${d.email} (${d.role})`);
    }
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} admins`);
}

// ─── Step 3: Migrate Medications ───────────────────────────────────────────────

async function migrateMedications() {
  console.log('\n═══ Step 3: Migrating Medications ═══');

  const snapshot = await firestore.collection('medications').get();
  console.log(`  Found ${snapshot.size} medication documents`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const d = doc.data();

    const { error } = await supabase.from('medications').insert({
      code: doc.id,
      title: d.title,
      description: d.description,
      badge: d.badge,
      category: d.category,
      key_info: d.keyInfo || [],
      nhs_link: d.nhsLink || '',
      trend_links: d.trendLinks || [],
      sick_days_needed: d.sickDaysNeeded || false,
      review_months: d.reviewMonths || 12,
      content_review_date: d.contentReviewDate || '',
      is_deleted: d.is_deleted || false,
      created_at: toIso(d.created_at),
      created_by: d.created_by ? uidMap.get(d.created_by) || null : null,
      updated_at: toIso(d.updated_at),
      updated_by: d.updated_by ? uidMap.get(d.updated_by) || null : null,
      deleted_at: toIso(d.deleted_at),
      deleted_by: d.deleted_by ? uidMap.get(d.deleted_by) || null : null,
    });

    if (error) {
      console.error(`  ✗ Failed to insert medication ${doc.id}: ${error.message}`);
    } else {
      migrated++;
      console.log(`  ✓ ${doc.id} - ${d.title}`);
    }
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} medications`);
}

// ─── Step 4: Migrate Practices ─────────────────────────────────────────────────

async function migratePractices() {
  console.log('\n═══ Step 4: Migrating Practices ═══');

  const snapshot = await firestore.collection('practices').get();
  console.log(`  Found ${snapshot.size} practice documents`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const d = doc.data();

    const { data: inserted, error } = await supabase
      .from('practices')
      .insert({
        name: d.name,
        name_lowercase: d.name_lowercase,
        ods_code: d.ods_code || null,
        contact_email: d.contact_email || null,
        contact_name: d.contact_name || null,
        is_active: d.is_active || false,
        auth_uid: d.auth_uid ? uidMap.get(d.auth_uid) || null : null,
        selected_medications: d.selected_medications || [],
        medication_review_dates: d.medication_review_dates || {},
        link_visit_count: d.link_visit_count || 0,
        patient_rating_count: d.patient_rating_count || 0,
        patient_rating_total: d.patient_rating_total || 0,
        last_accessed: toIso(d.last_accessed),
        signed_up_at: toIso(d.signed_up_at),
        updated_at: toIso(d.updated_at),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`  ✗ Failed to insert practice ${d.name}: ${error.message}`);
    } else {
      practiceIdMap.set(doc.id, inserted.id);
      migrated++;
      console.log(`  ✓ ${d.name} (${doc.id} → ${inserted.id})`);
    }
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} practices`);
}

// ─── Step 5: Migrate Login Audit ───────────────────────────────────────────────

async function migrateLoginAudit() {
  console.log('\n═══ Step 5: Migrating Login Audit ═══');

  const snapshot = await firestore.collection('login_audit').get();
  console.log(`  Found ${snapshot.size} login audit documents`);

  let migrated = 0;
  const batch: Record<string, unknown>[] = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();

    batch.push({
      uid: d.uid ? uidMap.get(d.uid) || null : null,
      email: d.email || null,
      actor_type: d.actorType || null,
      actor_name: d.actorName || null,
      actor_id: d.actorId ? practiceIdMap.get(d.actorId) || d.actorId : null,
      admin_role: d.adminRole || null,
      portal: d.portal || null,
      user_agent: d.userAgent || '',
      ip_address: d.ipAddress || '',
      created_at: toIso(d.created_at),
    });
  }

  // Insert in chunks of 100
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const { error } = await supabase.from('login_audit').insert(chunk);
    if (error) {
      console.error(`  ✗ Failed to insert login audit chunk at ${i}: ${error.message}`);
    } else {
      migrated += chunk.length;
    }
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} login audit entries`);
}

// ─── Step 6: Migrate Audit Log ─────────────────────────────────────────────────

async function migrateAuditLog() {
  console.log('\n═══ Step 6: Migrating Audit Log ═══');

  const snapshot = await firestore.collection('audit_log').get();
  console.log(`  Found ${snapshot.size} audit log documents`);

  let migrated = 0;
  const batch: Record<string, unknown>[] = [];

  for (const doc of snapshot.docs) {
    const d = doc.data();

    batch.push({
      action: d.action,
      actor_uid: d.actorUid ? uidMap.get(d.actorUid) || null : null,
      code: d.code || null,
      timestamp: toIso(d.timestamp),
      previous_state: d.previous_state || null,
      new_state: d.new_state || null,
    });
  }

  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const { error } = await supabase.from('audit_log').insert(chunk);
    if (error) {
      console.error(`  ✗ Failed to insert audit log chunk at ${i}: ${error.message}`);
    } else {
      migrated += chunk.length;
    }
  }

  console.log(`  Migrated ${migrated} / ${snapshot.size} audit log entries`);
}

// ─── Step 7: Verify row counts ─────────────────────────────────────────────────

async function verifyCounts() {
  console.log('\n═══ Verification: Row Counts ═══');

  const tables = ['admins', 'medications', 'practices', 'login_audit', 'audit_log'];
  const firestoreCollections = ['admins', 'medications', 'practices', 'login_audit', 'audit_log'];

  for (let i = 0; i < tables.length; i++) {
    const fsSnapshot = await firestore.collection(firestoreCollections[i]).get();
    const { count: sbCount } = await supabase
      .from(tables[i])
      .select('*', { count: 'exact', head: true });

    const match = fsSnapshot.size === sbCount ? '✓' : '✗ MISMATCH';
    console.log(`  ${match}  ${tables[i]}: Firestore=${fsSnapshot.size}  Supabase=${sbCount}`);
  }
}

// ─── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Firebase → Supabase Migration              ║');
  console.log('╚══════════════════════════════════════════════╝');

  await migrateAuthUsers();
  await migrateAdmins();
  await migrateMedications();
  await migratePractices();
  await migrateLoginAudit();
  await migrateAuditLog();
  await verifyCounts();

  console.log('\n✓ Migration complete!');
  console.log('  IMPORTANT: All users will need to reset their passwords.');
  console.log('  Send password reset emails via Supabase Dashboard or API.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
