import { supabase } from './supabase';
import type { CardTemplateBuilderType, CardTemplateRecord, CardTemplateRevisionRecord } from './cardTemplateTypes';

export const buildCardTemplateKey = (builderType: CardTemplateBuilderType, templateId: string) => `${builderType}:${templateId}`;

export async function fetchCardTemplates<T = unknown>(
  builderType: CardTemplateBuilderType,
  templateIds?: string[],
): Promise<CardTemplateRecord<T>[]> {
  let query = supabase
    .from('card_templates')
    .select('*')
    .eq('builder_type', builderType)
    .order('template_id', { ascending: true });

  if (templateIds && templateIds.length > 0) {
    query = query.in('template_id', templateIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CardTemplateRecord<T>[];
}

export async function fetchCardTemplateRevisions<T = unknown>(
  builderType: CardTemplateBuilderType,
  templateId: string,
): Promise<CardTemplateRevisionRecord<T>[]> {
  const templateKey = buildCardTemplateKey(builderType, templateId);
  const { data, error } = await supabase
    .from('card_template_revisions')
    .select('*')
    .eq('template_key', templateKey);

  if (error) throw error;
  return ((data || []) as CardTemplateRevisionRecord<T>[]).sort((left, right) => {
    const leftTime = new Date((left as { created_at?: string }).created_at || 0).getTime();
    const rightTime = new Date((right as { created_at?: string }).created_at || 0).getTime();

    if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.version - left.version;
  });
}
