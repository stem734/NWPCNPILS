export const PRACTICE_FEATURE_KEYS = [
  'medication_enabled',
  'healthcheck_enabled',
  'screening_enabled',
  'immunisation_enabled',
  'ltc_enabled',
] as const;

export type PracticeFeatureKey = typeof PRACTICE_FEATURE_KEYS[number];

export type PracticeFeatureSettings = Record<PracticeFeatureKey, boolean>;

export const DEFAULT_PRACTICE_FEATURE_SETTINGS: PracticeFeatureSettings = {
  medication_enabled: true,
  healthcheck_enabled: false,
  screening_enabled: false,
  immunisation_enabled: false,
  ltc_enabled: false,
};

export const PRACTICE_FEATURE_METADATA: Record<
  PracticeFeatureKey,
  { label: string; shortLabel: string; description: string; patientLabel: string }
> = {
  medication_enabled: {
    label: 'Medication cards',
    shortLabel: 'Medication',
    description: 'Enable medication information cards for this practice.',
    patientLabel: 'medication information',
  },
  healthcheck_enabled: {
    label: 'Health checks',
    shortLabel: 'Health checks',
    description: 'Enable NHS Health Check result pages for this practice using the shared global content.',
    patientLabel: 'health check information',
  },
  screening_enabled: {
    label: 'Screening',
    shortLabel: 'Screening',
    description: 'Enable screening information pages for this practice using the shared global templates.',
    patientLabel: 'screening information',
  },
  immunisation_enabled: {
    label: 'Immunisations',
    shortLabel: 'Immunisations',
    description: 'Enable immunisation aftercare pages for this practice using the shared global templates.',
    patientLabel: 'immunisation information',
  },
  ltc_enabled: {
    label: 'Long term conditions',
    shortLabel: 'Long term conditions',
    description: 'Enable long term condition pages for this practice using the shared global templates.',
    patientLabel: 'long term condition information',
  },
};

export const coercePracticeFeatureSettings = (value: unknown): PracticeFeatureSettings => {
  const row = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    medication_enabled: row.medication_enabled !== false,
    healthcheck_enabled: row.healthcheck_enabled === true,
    screening_enabled: row.screening_enabled === true,
    immunisation_enabled: row.immunisation_enabled === true,
    ltc_enabled: row.ltc_enabled === true,
  };
};
