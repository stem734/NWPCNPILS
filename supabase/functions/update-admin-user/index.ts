import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin: actingAdmin } = await assertAdmin(req.headers.get('Authorization'));
    const { uid, email, name, isActive } = await req.json();

    if (!uid || !email || !name) {
      return errorResponse('uid, email, and name are required');
    }

    const supabase = createServiceClient();

    // Check target admin exists
    const { data: targetAdmin, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('uid', uid)
      .single();

    if (fetchError || !targetAdmin) {
      return errorResponse('Administrator account not found', 404);
    }

    // Owner protection
    if (targetAdmin.role === 'owner' && actingAdmin.role !== 'owner') {
      return errorResponse('Only the owner can modify the owner account', 403);
    }

    // Update auth user
    const { error: authError } = await supabase.auth.admin.updateUserById(uid, {
      email: email.trim(),
      user_metadata: { name: name.trim() },
      ban_duration: isActive === false ? 'none' : undefined,
    });

    if (authError) {
      return errorResponse(`Failed to update auth user: ${authError.message}`, 500);
    }

    // Update admin record
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        email: email.trim(),
        name: name.trim(),
        is_active: Boolean(isActive),
        updated_at: new Date().toISOString(),
      })
      .eq('uid', uid);

    if (updateError) {
      return errorResponse(`Failed to update admin record: ${updateError.message}`, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
