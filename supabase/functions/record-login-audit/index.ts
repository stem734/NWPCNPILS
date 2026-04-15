import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, getAuthUser, corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase-client.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getAuthUser(req.headers.get('Authorization'));
    const { portal, userAgent } = await req.json() as {
      portal?: 'admin' | 'practice';
      userAgent?: string;
    };

    const supabase = createServiceClient();

    // Check if user is an admin
    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .eq('uid', user.id)
      .single();

    // Get client IP from headers
    const forwarded = req.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : '';

    let auditRecord;

    if (adminData) {
      auditRecord = {
        uid: user.id,
        email: adminData.email,
        actor_type: 'admin' as const,
        actor_name: adminData.name || adminData.email,
        admin_role: adminData.role,
        portal: portal === 'practice' ? 'practice' as const : 'admin' as const,
        user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : '',
        ip_address: ipAddress,
      };
    } else {
      // Look up practice
      const { data: practiceData } = await supabase
        .from('practices')
        .select('*')
        .eq('auth_uid', user.id)
        .single();

      if (!practiceData) {
        return errorResponse('No linked account found for login audit', 404);
      }

      auditRecord = {
        uid: user.id,
        email: typeof practiceData.contact_email === 'string' ? practiceData.contact_email : user.email || '',
        actor_type: 'practice' as const,
        actor_name: typeof practiceData.name === 'string' ? practiceData.name : 'Practice user',
        actor_id: practiceData.id,
        portal: 'practice' as const,
        user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : '',
        ip_address: ipAddress,
      };
    }

    const { error } = await supabase.from('login_audit').insert(auditRecord);
    if (error) {
      return errorResponse(`Failed to record audit: ${error.message}`, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Internal error', 500);
  }
});
