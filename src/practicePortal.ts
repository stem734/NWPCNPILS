import type { MedContent } from './medicationData';
import { supabase } from './supabase';

export const PRACTICE_SELECTION_STORAGE_KEY = 'practice-dashboard:selected-practice';
export const GLOBAL_TEMPLATE_DISCLAIMER_VERSION = 'global_v1';
export const CUSTOM_CARD_DISCLAIMER_VERSION = 'custom_v1';

export const GLOBAL_TEMPLATE_DISCLAIMER_TEXT =
  'I confirm that I have reviewed this global medication card, understand it is provided as a shared template, and accept responsibility for deciding whether it is suitable for use at my practice.';

export const CUSTOM_CARD_DISCLAIMER_TEXT =
  'I understand that I am creating or updating a practice-specific medication card and that my practice is responsible for reviewing, maintaining, and governing this custom content.';

export type PracticeSummary = {
  id: string;
  name: string;
  ods_code?: string | null;
  contact_email?: string | null;
  is_active: boolean;
  link_visit_count?: number | null;
  patient_rating_count?: number | null;
  patient_rating_total?: number | null;
  last_accessed?: string | null;
  selected_medications?: string[] | null;
};

export type PracticeMembership = {
  id: string;
  practice_id: string;
  user_uid: string;
  role: 'admin' | 'editor';
  is_default: boolean;
  practice: PracticeSummary;
};

export type AppUserSummary = {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  global_role?: 'owner' | 'admin' | null;
  memberships: PracticeMembership[];
};

export type PracticeCardSource = 'global' | 'custom' | 'placeholder';

export type PracticeMedicationCardRow = {
  practice_id: string;
  code: string;
  source_type: 'global' | 'custom';
  title?: string | null;
  description?: string | null;
  badge?: 'NEW' | 'REAUTH' | 'GENERAL' | null;
  category?: string | null;
  key_info?: string[] | null;
  nhs_link?: string | null;
  trend_links?: Array<{ title: string; url: string }> | null;
  sick_days_needed?: boolean | null;
  review_months?: number | null;
  content_review_date?: string | null;
  disclaimer_version: string;
  accepted_at?: string | null;
  accepted_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type ResolvedMedicationCard = MedContent & {
  state: PracticeCardSource;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toTrendLinks = (value: unknown): Array<{ title: string; url: string }> =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const row = isRecord(item) ? item : {};
          return {
            title: typeof row.title === 'string' ? row.title : '',
            url: typeof row.url === 'string' ? row.url : '',
          };
        })
        .filter((item) => item.title && item.url)
    : [];

export const coerceResolvedMedicationCard = (value: unknown): ResolvedMedicationCard => {
  const row = isRecord(value) ? value : {};

  return {
    state: row.state === 'custom' || row.state === 'global' ? row.state : 'placeholder',
    code: typeof row.code === 'string' ? row.code : '',
    badge: row.badge === 'NEW' || row.badge === 'REAUTH' ? row.badge : 'GENERAL',
    title: typeof row.title === 'string' ? row.title : 'Medication information unavailable',
  description:
    typeof row.description === 'string'
      ? row.description
      : 'No drug information available at your practice for this particular medication.',
    category: typeof row.category === 'string' ? row.category : 'Medication Information',
    keyInfo: toStringArray(row.keyInfo),
    nhsLink: typeof row.nhsLink === 'string' ? row.nhsLink : '',
    trendLinks: toTrendLinks(row.trendLinks),
    sickDaysNeeded: Boolean(row.sickDaysNeeded),
    reviewMonths: typeof row.reviewMonths === 'number' ? row.reviewMonths : undefined,
    contentReviewDate: typeof row.contentReviewDate === 'string' ? row.contentReviewDate : undefined,
  };
};

export async function resolvePatientMedicationCards(orgName: string, requestedCodes: string[]): Promise<ResolvedMedicationCard[]> {
  const { data, error } = await supabase.rpc('resolve_patient_medication_cards', {
    org_name: orgName,
    requested_codes: requestedCodes,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(coerceResolvedMedicationCard);
}
