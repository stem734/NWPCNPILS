import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { assertAdmin } from '../_shared/assert-admin.ts';
import { createServiceClient, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';
import { Resend } from 'https://esm.sh/resend@6';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { admin: actingAdmin } = await assertAdmin(req.headers.get('Authorization'));
    const { email, name } = await req.json();

    if (!email || typeof email !== 'string') {
      return errorResponse('Admin email is required');
    }

    const supabase = createServiceClient();

    // Create auth user with a random temp password
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: userRecord, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: typeof name === 'string' && name.trim() ? name.trim() : undefined },
    });

    if (createError || !userRecord.user) {
      return errorResponse(createError?.message || 'Failed to create auth user', 500);
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('admins').insert({
      uid: userRecord.user.id,
      email: email.trim(),
      name: typeof name === 'string' && name.trim() ? name.trim() : email.trim(),
      is_active: true,
      role: 'admin',
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      return errorResponse(`Failed to create admin record: ${insertError.message}`, 500);
    }

    // Generate password reset link
    const appBaseUrl = (Deno.env.get('APP_BASE_URL') || 'https://www.mymedinfo.info').replace(/\/$/, '');
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: { redirectTo: `${appBaseUrl}/admin` },
    });

    const resetLink = linkData?.properties?.action_link || '';

    // Send welcome email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
    if (resendApiKey && resendFromEmail && resetLink) {
      const resend = new Resend(resendApiKey);
      const displayName = typeof name === 'string' && name.trim() ? name.trim() : email.trim();
      await resend.emails.send({
        from: resendFromEmail,
        to: email.trim(),
        subject: 'Set up your MyMedInfo administrator account',
        text: `Hello ${displayName},\n\nYour MyMedInfo administrator account has been created. Set your password using this secure link:\n${resetLink}\n\nAfter setting your password, sign in at ${appBaseUrl}/admin\n`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #212b32;">
            <h2 style="color: #005eb8;">Welcome to MyMedInfo</h2>
            <p>Hello ${displayName},</p>
            <p>Your MyMedInfo administrator account has been created. Use the button below to set your password.</p>
            <p style="margin: 24px 0;">
              <a href="${resetLink}" style="background: #005eb8; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">Set Your Password</a>
            </p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>After setting your password, sign in at <a href="${appBaseUrl}/admin">${appBaseUrl}/admin</a>.</p>
          </div>
        `,
      });
    }

    return jsonResponse({ success: true, uid: userRecord.user.id, resetLink });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
