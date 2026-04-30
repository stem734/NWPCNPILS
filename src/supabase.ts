import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    // Disabled so the Supabase client does not automatically consume the
    // one-time ?code= param on initialisation. ResetPassword.tsx calls
    // exchangeCodeForSession() explicitly only after the user clicks through.
    detectSessionInUrl: false,
  },
});
