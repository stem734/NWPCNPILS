import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin: actingAdmin, userId } = await assertAdmin(req.headers.get('Authorization'));
    const { uid } = await req.json();

    if (!uid) {
      return errorResponse('Administrator uid is required');
    }

    if (uid === userId) {
      return errorResponse('You cannot delete your own administrator account');
    }

    const supabase = createServiceClient();

    // Check target exists
    const { data: targetAdmin, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('uid', uid)
      .single();

    if (fetchError || !targetAdmin) {
      return errorResponse('Administrator account not found', 404);
    }

    // Permission check: only owner can delete
    if (targetAdmin.role === 'owner' || actingAdmin.role !== 'owner') {
      return errorResponse('Only the owner can delete administrator accounts', 403);
    }

    // Delete auth user (cascades to admins table via FK)
    const { error: authError } = await supabase.auth.admin.deleteUser(uid);
    if (authError) {
      return errorResponse(`Failed to delete auth user: ${authError.message}`, 500);
    }

    // Explicit delete from admins table (in case cascade not configured)
    await supabase.from('admins').delete().eq('uid', uid);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
