export interface MedContent {
  code: string;
  title: string;
  description: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  category: string;
  nhsLink?: string;
  trendLinks: { title: string; url: string }[];
  keyInfo: string[];
  sickDaysNeeded?: boolean;
}

export const MEDICATIONS: MedContent[] = [
  {
    code: '101',
    title: 'Sulfonylurea - Starting Treatment',
    description: 'You are starting a Sulfonylurea medication (such as Gliclazide). This medicine helps your body produce more insulin to lower blood glucose.',
    badge: 'NEW',
    category: 'Sulfonylureas',
    nhsLink: 'https://www.nhs.uk/medicines/gliclazide/',
    trendLinks: [
      { title: 'Hypoglycaemia Explained', url: 'https://trenddiabetes.online/wp-content/uploads/2026/01/A5_Hypo_TREND.pdf' }
    ],
    keyInfo: [
      'Take this medication with a meal.',
      'Be aware of "hypos" (low blood sugar).',
      'Always carry glucose or a sugary snack.'
    ]
  },
  {
    code: '102',
    title: 'Sulfonylurea - Reauthorisation',
    description: 'Your Sulfonylurea medication has been reviewed and reauthorised for another year. It continues to be an important part of your glucose management.',
    badge: 'REAUTH',
    category: 'Sulfonylureas',
    nhsLink: 'https://www.nhs.uk/medicines/gliclazide/',
    trendLinks: [
      { title: 'Keeping well with T2 Diabetes', url: 'https://trenddiabetes.online/wp-content/uploads/2023/10/A5_Older_Person_TREND.pdf' }
    ],
    keyInfo: [
      'Continue taking as prescribed, usually with breakfast.',
      'Maintain regular check-ups.'
    ]
  },
  {
    code: '201',
    title: 'SGLT2 Inhibitor - First Initiation',
    description: 'You are starting an SGLT2 inhibitor (such as Dapagliflozin or Empagliflozin). This medicine helps your kidneys remove excess sugar through your urine.',
    badge: 'NEW',
    category: 'SGLT2 Inhibitors',
    nhsLink: 'https://www.nhs.uk/conditions/type-2-diabetes/medicine/',
    trendLinks: [
      { title: 'A simple guide to SGLT2 inhibitors', url: 'https://trenddiabetes.online/wp-content/uploads/2025/10/SGLT2i_TREND_FINAL_v2.pdf' },
      { title: 'Genital Fungal Infection Prevention', url: 'https://trenddiabetes.online/wp-content/uploads/2025/07/A5_Genital_TREND.pdf' }
    ],
    keyInfo: [
      'Stay hydrated by drinking plenty of water.',
      'Maintain good personal hygiene to reduce infection risk.',
      'Be aware of the risk of Ketoacidosis (rare but serious).'
    ],
    sickDaysNeeded: true
  },
  {
    code: '202',
    title: 'SGLT2 Inhibitor - Reauthorisation',
    description: 'Your SGLT2 inhibitor treatment has been reviewed and reauthorised. This medication provides protection for your heart and kidneys.',
    badge: 'REAUTH',
    category: 'SGLT2 Inhibitors',
    nhsLink: 'https://www.nhs.uk/conditions/type-2-diabetes/medicine/',
    trendLinks: [
      { title: 'A simple guide to SGLT2 inhibitors', url: 'https://trenddiabetes.online/wp-content/uploads/2025/10/SGLT2i_TREND_FINAL_v2.pdf' },
      { title: 'Sick Day Rules', url: 'https://trenddiabetes.online/wp-content/uploads/2025/08/A5_T2Illness_TREND.pdf' }
    ],
    keyInfo: [
      'Continue to stay hydrated.',
      'Remember "Sick Day Rules" (Pause medication if you are unable to eat or drink).'
    ],
    sickDaysNeeded: true
  },
  {
    code: '301',
    title: 'Emollients and Skin Care',
    description: 'Emollients are moisturising treatments applied directly to the skin to soothe it and hydrate it.',
    badge: 'GENERAL',
    category: 'Dermatology',
    nhsLink: 'https://www.nhs.uk/conditions/emollients/',
    trendLinks: [],
    keyInfo: [
      'Apply frequently and in the direction of hair growth.',
      'Important: Emollients with paraffin or oils are flammable. Keep away from naked flames.',
      'Wash your hands after application if smoking.'
    ]
  },
  {
    code: '401',
    title: 'Insulin Therapy',
    description: 'Insulin is a vital hormone for managing your blood glucose levels. You have been prescribed or reviewed for insulin therapy.',
    badge: 'NEW',
    category: 'Insulin',
    nhsLink: 'https://www.nhs.uk/conditions/type-1-diabetes/insulin/',
    trendLinks: [
      { title: 'Keeping safe with insulin therapy', url: 'https://trenddiabetes.online/wp-content/uploads/2025/08/A5_Insulin_TREND.pdf' },
      { title: 'Using an insulin cartridge pen', url: 'https://trenddiabetes.online/wp-content/uploads/2023/08/A4_Novopen_Factsheet_TREND_v6-2.pdf' }
    ],
    keyInfo: [
      'Rotate your injection sites regularly.',
      'Check your injection sites for lumps (Lipohypertrophy).',
      'Inform the DVLA if you are a driver on insulin.'
    ],
    sickDaysNeeded: true
  },
  {
    code: '501',
    title: 'Mounjaro (Tirzepatide)',
    description: 'Mounjaro is a medication for Type 2 Diabetes that mimics hormones to improve blood sugar control and support weight management.',
    badge: 'NEW',
    category: 'GLP-1 / GIP',
    nhsLink: 'https://www.nhs.uk/medicines/tirzepatide-mounjaro/',
    trendLinks: [
      { title: 'GLP-1 RA and GIP guide', url: 'https://trenddiabetes.online/wp-content/uploads/2025/11/GLP1RA_TREND_FINAL.pdf' }
    ],
    keyInfo: [
      'Usually a once-weekly injection.',
      'May cause nausea or gastrointestinal side effects initially.',
      'Report any severe abdominal pain immediately.'
    ]
  }
];

export const MED_MAP: Record<string, MedContent> = Object.fromEntries(
  MEDICATIONS.map(m => [m.code, m])
);
