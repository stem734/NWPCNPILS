import { supabase } from './supabase';

export type LocalResourceLink = {
  id: string;
  title: string;
  description: string;
  category: string;
  website: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type LocalResourceDraft = Omit<LocalResourceLink, 'id' | 'created_at' | 'updated_at'>;

const coerceString = (value: unknown) => (typeof value === 'string' ? value : '');

const coerceLocalResourceLink = (value: unknown): LocalResourceLink => {
  const row = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    id: coerceString(row.id),
    title: coerceString(row.title),
    description: coerceString(row.description),
    category: coerceString(row.category),
    website: coerceString(row.website),
    phone: coerceString(row.phone),
    email: coerceString(row.email),
    is_active: row.is_active !== false,
    created_at: coerceString(row.created_at),
    updated_at: coerceString(row.updated_at),
  };
};

export const emptyLocalResourceDraft = (): LocalResourceDraft => ({
  title: '',
  description: '',
  category: '',
  website: '',
  phone: '',
  email: '',
  is_active: true,
});

export async function fetchLocalResourceLinks(activeOnly = false): Promise<LocalResourceLink[]> {
  let query = supabase
    .from('local_resource_links')
    .select('*')
    .order('category', { ascending: true })
    .order('title', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(coerceLocalResourceLink).filter((row) => row.id && row.title);
}

export async function upsertLocalResourceLink(resource: Partial<LocalResourceLink> & LocalResourceDraft): Promise<void> {
  const payload = {
    ...(resource.id ? { id: resource.id } : {}),
    title: resource.title.trim(),
    description: resource.description.trim(),
    category: resource.category.trim(),
    website: resource.website.trim(),
    phone: resource.phone.trim(),
    email: resource.email.trim(),
    is_active: resource.is_active,
  };

  const { error } = await supabase.from('local_resource_links').upsert(payload);
  if (error) {
    throw error;
  }
}

export async function deleteLocalResourceLink(id: string): Promise<void> {
  const { error } = await supabase.from('local_resource_links').delete().eq('id', id);
  if (error) {
    throw error;
  }
}
