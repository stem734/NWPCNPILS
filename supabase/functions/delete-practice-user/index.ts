import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAdmin(req.headers.get('Authorization'));
    const { uid } = await req.json() as { uid?: string };

    if (!uid) {
      return errorResponse('Practice user uid is required');
    }

    const supabase = createServiceClient();
    const { data: targetPracticeUser, error: fetchError } = await supabase
      .from('practice_users')
      .select('uid')
      .eq('uid', uid)
      .single();

    if (fetchError || !targetPracticeUser) {
      return errorResponse('Practice user account not found', 404);
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(uid);
    if (authError) {
      return errorResponse(`Failed to delete auth user: ${authError.message}`, 500);
    }

    await supabase.from('practice_users').delete().eq('uid', uid);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
