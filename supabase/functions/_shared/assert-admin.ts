import { createServiceClient, getAuthUser } from './supabase-client.ts';

export type AdminRecord = {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  role: 'owner' | 'admin';
  created_at: string;
  updated_at: string;
};

/**
 * Verify the caller is an active admin. Bootstraps the first admin
 * if no admins exist yet (same behaviour as the Firebase Cloud Function).
 *
 * Returns the admin record on success; throws on failure.
 */
export async function assertAdmin(authHeader: string | null): Promise<{ admin: AdminRecord; userId: string }> {
  const user = await getAuthUser(authHeader);
  const supabase = createServiceClient();

  // Check if user is already an admin
  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('uid', user.id)
    .single();

  if (admin) {
    if (!admin.is_active) {
      throw new Error('Administrator account is inactive');
    }
    return { admin: admin as AdminRecord, userId: user.id };
  }

  // Bootstrap: if no admins exist, make this user the owner
  const { count } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    throw new Error('Administrator access required');
  }

  const now = new Date().toISOString();
  const bootstrapAdmin: AdminRecord = {
    uid: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || user.email || 'Primary Administrator',
    is_active: true,
    role: 'owner',
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('admins').insert(bootstrapAdmin);
  if (error) throw new Error(`Failed to bootstrap admin: ${error.message}`);

  return { admin: bootstrapAdmin, userId: user.id };
}
