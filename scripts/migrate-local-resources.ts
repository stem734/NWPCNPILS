/**
 * Import local resource links from Firestore into Supabase.
 *
 * Prerequisites:
 * 1. Place the Firebase service account key at `scripts/firebase-service-account.json`
 * 2. Apply `supabase/local-resource-links.sql`
 * 3. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_KEY
 *    - FIRESTORE_RESOURCE_COLLECTION (optional, defaults to `local_resources`)
 *
 * Usage:
 *   FIRESTORE_RESOURCE_COLLECTION=resources npx tsx scripts/migrate-local-resources.ts
 */

import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Timestamp } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FIRESTORE_RESOURCE_COLLECTION = process.env.FIRESTORE_RESOURCE_COLLECTION || 'local_resources';

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
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const toSafeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const toIso = (value: unknown): string | null => {
  const maybeTimestamp = value as Timestamp | null | undefined;
  if (!maybeTimestamp || typeof maybeTimestamp.toDate !== 'function') {
    return null;
  }
  return maybeTimestamp.toDate().toISOString();
};

const firstString = (data: Record<string, unknown>, fields: string[]): string => {
  for (const field of fields) {
    const value = toSafeString(data[field]);
    if (value) return value;
  }
  return '';
};

const normaliseWebsiteUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const firstBoolean = (data: Record<string, unknown>, fields: string[], fallback: boolean): boolean => {
  for (const field of fields) {
    if (typeof data[field] === 'boolean') return Boolean(data[field]);
  }
  return fallback;
};

async function main() {
  console.log('==========================================');
  console.log(' Firestore Local Resources Import');
  console.log('==========================================');
  console.log(`Reading Firestore collection: ${FIRESTORE_RESOURCE_COLLECTION}`);

  const snapshot = await firestore.collection(FIRESTORE_RESOURCE_COLLECTION).get();
  console.log(`Found ${snapshot.size} Firestore resource document(s).`);

  let imported = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const title = firstString(data, ['title', 'name', 'label']);
    const website = normaliseWebsiteUrl(firstString(data, ['website', 'url', 'link', 'href']));
    const phone = firstString(data, ['phone', 'telephone', 'tel']);
    const email = firstString(data, ['email', 'mail']);

    if (!title || (!website && !phone && !email)) {
      skipped++;
      console.warn(`  - Skipping ${doc.id}: missing title or contact details`);
      continue;
    }

    const { error } = await supabase
      .from('local_resource_links')
      .upsert({
        legacy_firestore_id: doc.id,
        title,
        show_title_on_card: firstBoolean(data, ['show_title_on_card', 'showTitleOnCard', 'show_title', 'showTitle'], true),
        description: firstString(data, ['description', 'summary', 'copy', 'body']),
        category: firstString(data, ['category', 'type', 'service', 'domain']),
        website,
        website_label: firstString(data, ['website_label', 'websiteLabel', 'website_link_text', 'websiteLinkText']),
        phone,
        phone_label: firstString(data, ['phone_label', 'phoneLabel', 'phone_link_text', 'phoneLinkText']),
        email,
        email_label: firstString(data, ['email_label', 'emailLabel', 'email_link_text', 'emailLinkText']),
        city: firstString(data, ['city', 'town']),
        county_area: firstString(data, ['county_area', 'countyArea', 'county', 'area']),
        is_active: firstBoolean(data, ['is_active', 'active', 'enabled'], true),
        created_at: toIso(data.created_at) || toIso(data.createdAt) || new Date().toISOString(),
        updated_at: toIso(data.updated_at) || toIso(data.updatedAt) || new Date().toISOString(),
      }, { onConflict: 'legacy_firestore_id' });

    if (error) {
      skipped++;
      console.error(`  x Failed to import ${doc.id}: ${error.message}`);
      continue;
    }

    imported++;
    console.log(`  + ${title}`);
  }

  console.log(`Imported ${imported}; skipped ${skipped}.`);
}

main().catch((error) => {
  console.error('Local resource import failed:', error);
  process.exit(1);
});
