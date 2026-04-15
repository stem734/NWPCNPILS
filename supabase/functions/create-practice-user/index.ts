import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAdmin(req.headers.get('Authorization'));
    const { email, practiceId } = await req.json();

    if (!email || !practiceId) {
      return errorResponse('Email and practiceId are required');
    }

    // TODO: Uncomment for production - restrict to nhs.net only
    // if (!email.toLowerCase().endsWith('@nhs.net')) {
    //   return errorResponse('Only nhs.net email addresses are accepted');
    // }

    const supabase = createServiceClient();

    // Create auth account with random temp password
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: userRecord, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError || !userRecord.user) {
      return errorResponse(createError?.message || 'Failed to create user', 500);
    }

    // Link the auth UID to the practice document
    const { error: updateError } = await supabase
      .from('practices')
      .update({
        auth_uid: userRecord.user.id,
        contact_email: email,
      })
      .eq('id', practiceId);

    if (updateError) {
      return errorResponse(`Failed to link user to practice: ${updateError.message}`, 500);
    }

    // Generate password reset link
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    const resetLink = linkData?.properties?.action_link || '';

    return jsonResponse({
      success: true,
      uid: userRecord.user.id,
      resetLink,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
