import { CLINICAL_DOMAIN_IDS, PREVIEW_DOMAIN_CONFIGS } from './healthCheckVariantConfig';
import { MEDICATIONS } from './medicationData';
import {
  IMMUNISATION_TEMPLATES,
  LONG_TERM_CONDITION_TEMPLATES,
  SCREENING_TEMPLATES,
} from './patientTemplateCatalog';

export type DemoSample = {
  id: string;
  category: 'Medication' | 'Health check' | 'Screening' | 'Immunisation' | 'Long term condition';
  title: string;
  description: string;
  practiceName: string;
  params: Record<string, string>;
};

const DEMO_PRACTICE_NAME = 'Demo GP Practice';

export const DEMO_SAMPLES: DemoSample[] = [
  ...MEDICATIONS.map((medication) => ({
    id: `medication-${medication.code}`,
    category: 'Medication' as const,
    title: medication.title,
    description: medication.category,
    practiceName: DEMO_PRACTICE_NAME,
    params: {
      type: 'meds',
      codes: medication.code,
    },
  })),
  ...CLINICAL_DOMAIN_IDS.map((domainId) => ({
    id: `healthcheck-${domainId}`,
    category: 'Health check' as const,
    title: PREVIEW_DOMAIN_CONFIGS[domainId].heading,
    description: PREVIEW_DOMAIN_CONFIGS[domainId].subheading,
    practiceName: DEMO_PRACTICE_NAME,
    params: {
      type: 'healthcheck',
      previewOnly: '1',
      previewDomain: domainId,
    },
  })),
  ...Object.values(SCREENING_TEMPLATES).map((template) => ({
    id: `screening-${template.id}`,
    category: 'Screening' as const,
    title: template.label,
    description: template.headline,
    practiceName: DEMO_PRACTICE_NAME,
    params: {
      type: 'screening',
      screen: template.id,
    },
  })),
  ...Object.values(IMMUNISATION_TEMPLATES).map((template) => ({
    id: `immunisation-${template.id}`,
    category: 'Immunisation' as const,
    title: template.label,
    description: template.headline,
    practiceName: DEMO_PRACTICE_NAME,
    params: {
      type: 'imms',
      vaccine: template.id,
    },
  })),
  ...Object.values(LONG_TERM_CONDITION_TEMPLATES).map((template) => ({
    id: `ltc-${template.id}`,
    category: 'Long term condition' as const,
    title: template.label,
    description: template.headline,
    practiceName: DEMO_PRACTICE_NAME,
    params: {
      type: 'ltc',
      ltc: template.id,
    },
  })),
];

export const getRandomDemoSample = (): DemoSample => {
  const index = Math.floor(Math.random() * DEMO_SAMPLES.length);
  return DEMO_SAMPLES[index];
};

export const buildDemoPatientUrl = (sample: DemoSample) => {
  const params = new URLSearchParams({
    org: sample.practiceName,
    demo: '1',
    ...sample.params,
  });

  return `/patient?${params.toString()}`;
};

export const getDemoNoticeText = () =>
  'This is dummy information only and should not be used for clinical decisions.';
