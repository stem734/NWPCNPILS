/**
 * Send password reset emails to all migrated users.
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY env vars set
 *   - Supabase Auth "Site URL" set to https://www.mymedinfo.info
 *   - Supabase Auth "Redirect URLs" includes https://www.mymedinfo.info/**
 *
 * Usage:
 *   npx tsx scripts/send-password-resets.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('Failed to list users:', error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users. Sending password reset emails...\n`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;

    const { error: sendError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: 'https://www.mymedinfo.info/reset-password',
    });

    if (sendError) {
      console.error(`  ✗ ${user.email}: ${sendError.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${user.email}`);
      sent++;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
