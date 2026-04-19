/**
 * contentRouter.ts
 * ─────────────────────────────────────────────────────────────
 * Central content-type detection for incoming SystmOne strings.
 *
 * SystmOne redirects patients to:
 *   https://mymedinfo.info/patient?type=meds&org=PracticeName&codes=101,201
 *   https://mymedinfo.info/patient?type=healthcheck&org=PracticeName&s1=CSV
 *   https://mymedinfo.info/patient?type=screening&org=PracticeName&screen=cervical
 *   https://mymedinfo.info/patient?type=imms&org=PracticeName&vaccine=flu
 *
 * If no `type` param, auto-detect from other params present.
 * ─────────────────────────────────────────────────────────────
 */

export const CONTENT_TYPES = {
  MEDICATION:     'meds',
  HEALTH_CHECK:   'healthcheck',
  SCREENING:      'screening',
  IMMUNISATION:   'imms',
  LONG_TERM_CONDITION: 'ltc',
  PATIENT_LETTER: 'letter',
  UNKNOWN:        'unknown',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

/** Param hints used to auto-detect content type when `type` is absent */
const PARAM_HINTS: Record<ContentType, string[]> = {
  [CONTENT_TYPES.MEDICATION]:     ['codes', 'code', 'med'],
  [CONTENT_TYPES.HEALTH_CHECK]:   ['s1', 's1csv', 'payload', 'hc', 'bp', 'bmi', 'cvd', 'hba1c'],
  [CONTENT_TYPES.SCREENING]:      ['screen', 'screening'],
  [CONTENT_TYPES.IMMUNISATION]:    ['imms', 'vaccine', 'jab'],
  [CONTENT_TYPES.LONG_TERM_CONDITION]: ['ltc', 'condition'],
  [CONTENT_TYPES.PATIENT_LETTER]: ['letter', 'comms'],
  [CONTENT_TYPES.UNKNOWN]:        [],
};

export interface DetectedContent {
  contentType: ContentType;
  /** The raw org param, if present */
  org: string;
  /** All search params for downstream use */
  params: URLSearchParams;
}

/**
 * Detect which content type the incoming URL represents.
 *
 * Priority:
 *  1. Explicit `type` param   → direct match
 *  2. Known param names       → param-hint match
 *  3. Fallback                → UNKNOWN (shows landing)
 */
export function detectContentType(params: URLSearchParams): DetectedContent {
  const org = params.get('org')?.trim() || '';

  // 1. Explicit type param
  const explicitType = (params.get('type') || '').toLowerCase().trim();
  if (explicitType) {
    const matched = Object.values(CONTENT_TYPES).find(ct => ct === explicitType);
    if (matched) {
      return { contentType: matched, org, params };
    }
  }

  // 2. Auto-detect from param hints
  for (const [contentType, hints] of Object.entries(PARAM_HINTS)) {
    if (hints.some(hint => params.has(hint))) {
      return { contentType: contentType as ContentType, org, params };
    }
  }

  // 3. Fallback — if there's an org but no recognised params,
  //    default to medication (backwards compatible)
  if (org && params.toString().length > 0) {
    return { contentType: CONTENT_TYPES.MEDICATION, org, params };
  }

  return { contentType: CONTENT_TYPES.UNKNOWN, org, params };
}

/**
 * Human-readable label for each content type (used in headers/nav).
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  [CONTENT_TYPES.MEDICATION]:     'Medication Information',
  [CONTENT_TYPES.HEALTH_CHECK]:   'NHS Health Check Results',
  [CONTENT_TYPES.SCREENING]:      'Screening Information',
  [CONTENT_TYPES.IMMUNISATION]:    'Immunisation Information',
  [CONTENT_TYPES.LONG_TERM_CONDITION]: 'Long Term Condition Information',
  [CONTENT_TYPES.PATIENT_LETTER]: 'Patient Letter',
  [CONTENT_TYPES.UNKNOWN]:        'Patient Information',
};
