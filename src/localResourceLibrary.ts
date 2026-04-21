import { supabase } from './supabase';

export type LocalResourceLink = {
  id: string;
  title: string;
  show_title_on_card: boolean;
  description: string;
  category: string;
  website: string;
  website_label: string;
  phone: string;
  phone_label: string;
  email: string;
  email_label: string;
  city: string;
  county_area: string;
  is_active: boolean;
  legacy_firestore_id?: string;
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
    show_title_on_card: row.show_title_on_card !== false,
    description: coerceString(row.description),
    category: coerceString(row.category),
    website: coerceString(row.website),
    website_label: coerceString(row.website_label),
    phone: coerceString(row.phone),
    phone_label: coerceString(row.phone_label),
    email: coerceString(row.email),
    email_label: coerceString(row.email_label),
    city: coerceString(row.city),
    county_area: coerceString(row.county_area),
    is_active: row.is_active !== false,
    legacy_firestore_id: coerceString(row.legacy_firestore_id),
    created_at: coerceString(row.created_at),
    updated_at: coerceString(row.updated_at),
  };
};

export const emptyLocalResourceDraft = (): LocalResourceDraft => ({
  title: '',
  show_title_on_card: true,
  description: '',
  category: '',
  website: '',
  website_label: '',
  phone: '',
  phone_label: '',
  email: '',
  email_label: '',
  city: '',
  county_area: '',
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
    show_title_on_card: resource.show_title_on_card,
    description: resource.description.trim(),
    category: resource.category.trim(),
    website: resource.website.trim(),
    website_label: resource.website_label.trim(),
    phone: resource.phone.trim(),
    phone_label: resource.phone_label.trim(),
    email: resource.email.trim(),
    email_label: resource.email_label.trim(),
    city: resource.city.trim(),
    county_area: resource.county_area.trim(),
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
