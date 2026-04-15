import { createServiceClient, createUserClient, getAuthUser } from './supabase-client.ts';

export async function assertPracticeAccess(authHeader: string | null, practiceId: string) {
  if (!practiceId) {
    throw new Error('practiceId is required');
  }

  const user = await getAuthUser(authHeader);
  const userClient = createUserClient(authHeader!);

  const { data: membership, error: membershipError } = await userClient
    .from('practice_memberships')
    .select('practice_id')
    .eq('practice_id', practiceId)
    .eq('user_uid', user.id)
    .single();

  if (membershipError || !membership) {
    throw new Error('Practice access required');
  }

  const supabase = createServiceClient();
  const { data: practiceUser, error: practiceUserError } = await supabase
    .from('practice_users')
    .select('uid, is_active')
    .eq('uid', user.id)
    .single();

  if (practiceUserError || !practiceUser) {
    throw new Error('Practice user account not found');
  }

  if (!practiceUser.is_active) {
    throw new Error('Practice user account is inactive');
  }

  return { userId: user.id };
}
