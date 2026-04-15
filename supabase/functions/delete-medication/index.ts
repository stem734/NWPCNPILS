import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await assertAdmin(req.headers.get('Authorization'));
    const { code } = await req.json();

    if (!code) {
      return errorResponse('Medication code is required');
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();

    // Get existing doc for audit
    const { data: existingDoc } = await supabase
      .from('medications')
      .select('*')
      .eq('code', code)
      .single();

    // Soft delete
    const updateData = {
      is_deleted: true,
      deleted_at: now,
      deleted_by: userId,
    };

    const { error: updateError } = await supabase
      .from('medications')
      .update(updateData)
      .eq('code', code);

    if (updateError) {
      return errorResponse(`Failed to delete medication: ${updateError.message}`, 500);
    }

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'deleted',
      actor_uid: userId,
      code,
      timestamp: now,
      previous_state: existingDoc || null,
      new_state: { code, ...updateData },
    });

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
