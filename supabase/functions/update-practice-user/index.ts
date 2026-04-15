import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';
import {
  assertNoAdminConflict,
  assertNoPracticeUserConflict,
  assertPracticeIdsExist,
  normaliseEmail,
  replacePracticeMemberships,
} from '../_shared/practice-user-management.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAdmin(req.headers.get('Authorization'));

    const body = await req.json() as {
      uid?: string;
      email?: string;
      name?: string;
      isActive?: boolean;
      practiceIds?: string[];
      defaultPracticeId?: string;
    };

    if (!body.uid || !body.email || typeof body.email !== 'string') {
      return errorResponse('uid and email are required');
    }

    const supabase = createServiceClient();
    const email = normaliseEmail(body.email);
    const displayName = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email;
    const practiceIds = await assertPracticeIdsExist(supabase, Array.isArray(body.practiceIds) ? body.practiceIds : []);

    const { data: targetPracticeUser, error: fetchError } = await supabase
      .from('practice_users')
      .select('*')
      .eq('uid', body.uid)
      .single();

    if (fetchError || !targetPracticeUser) {
      return errorResponse('Practice user account not found', 404);
    }

    await assertNoAdminConflict(supabase, email, body.uid);
    await assertNoPracticeUserConflict(supabase, email, body.uid);

    const { error: authError } = await supabase.auth.admin.updateUserById(body.uid, {
      email,
      user_metadata: { name: displayName },
    });

    if (authError) {
      return errorResponse(`Failed to update auth user: ${authError.message}`, 500);
    }

    const { error: updateError } = await supabase
      .from('practice_users')
      .update({
        email,
        name: displayName,
        is_active: body.isActive !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', body.uid);

    if (updateError) {
      return errorResponse(`Failed to update practice user: ${updateError.message}`, 500);
    }

    await replacePracticeMemberships(supabase, body.uid, practiceIds, body.defaultPracticeId);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
