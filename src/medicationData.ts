export interface MedContent {
  code: string;
  title: string;
  description: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  category: string;
  reviewMonths?: number;
  contentReviewDate?: string;
  nhsLink?: string;
  trendLinks: { title: string; url: string }[];
  keyInfo: string[];
  sickDaysNeeded?: boolean;
}

export const MEDICATIONS: MedContent[] = [
  {
    code: '101',
    title: 'Sulfonylurea medicine - Starting Treatment',
    description: 'You are starting a sulfonylurea medicine. Examples include gliclazide and glimepiride. This medicine helps your body make more insulin to lower your blood sugar.',
    badge: 'NEW',
    category: 'Sulfonylureas',
    reviewMonths: 12,
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
    title: 'Sulfonylurea medicine - Reauthorisation',
    description: 'Your sulfonylurea medicine has been reviewed and renewed for another year. Examples include gliclazide and glimepiride. It remains an important part of your blood sugar treatment.',
    badge: 'REAUTH',
    category: 'Sulfonylureas',
    reviewMonths: 12,
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
    title: 'SGLT2 inhibitor medicine - Starting Treatment',
    description: 'You are starting an SGLT2 inhibitor medicine. Examples include dapagliflozin and empagliflozin, and many of these names end in "-gliflozin". This medicine helps your body pass extra sugar in your urine.',
    badge: 'NEW',
    category: 'SGLT2 Inhibitors',
    reviewMonths: 12,
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
    title: 'SGLT2 inhibitor medicine - Reauthorisation',
    description: 'Your SGLT2 inhibitor medicine has been reviewed and renewed. Examples include dapagliflozin and empagliflozin, and many of these names end in "-gliflozin". This treatment can also help protect your heart and kidneys.',
    badge: 'REAUTH',
    category: 'SGLT2 Inhibitors',
    reviewMonths: 12,
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
    title: 'Emollient and skin care treatment - Starting Treatment',
    description: 'You are starting an emollient and skin care treatment. Examples include Cetraben, Diprobase and E45. These products moisturise your skin and help soothe dryness and irritation.',
    badge: 'NEW',
    category: 'Dermatology',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/conditions/emollients/',
    trendLinks: [],
    keyInfo: [
      'Apply frequently and in the direction of hair growth.',
      'Important: Emollients with paraffin or oils are flammable. Keep away from naked flames.',
      'Wash your hands after application if smoking.'
    ]
  },
  {
    code: '302',
    title: 'Emollient and skin care treatment - Reauthorisation',
    description: 'Your emollient and skin care treatment has been reviewed and renewed. Examples include Cetraben, Diprobase and E45. Keep using it often to protect and soothe your skin.',
    badge: 'REAUTH',
    category: 'Dermatology',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/conditions/emollients/',
    trendLinks: [],
    keyInfo: [
      'Continue applying regularly and in the direction of hair growth.',
      'Important: Emollients with paraffin or oils are flammable. Keep away from naked flames.',
      'Re-order before you run out so your skin care routine stays consistent.'
    ]
  },
  {
    code: '401',
    title: 'Insulin therapy - Starting Treatment',
    description: 'You are starting insulin therapy. Examples include Levemir, Tresiba and Humulin. Insulin helps control your blood sugar and this guide will help you start treatment safely.',
    badge: 'NEW',
    category: 'Insulin',
    reviewMonths: 12,
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
    code: '402',
    title: 'Insulin therapy - Reauthorisation',
    description: 'Your insulin therapy has been reviewed and renewed. Examples include Levemir, Tresiba and Humulin. Keep following your insulin plan and checking your blood sugar as advised.',
    badge: 'REAUTH',
    category: 'Insulin',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/conditions/type-1-diabetes/insulin/',
    trendLinks: [
      { title: 'Keeping safe with insulin therapy', url: 'https://trenddiabetes.online/wp-content/uploads/2025/08/A5_Insulin_TREND.pdf' },
      { title: 'Using an insulin cartridge pen', url: 'https://trenddiabetes.online/wp-content/uploads/2023/08/A4_Novopen_Factsheet_TREND_v6-2.pdf' }
    ],
    keyInfo: [
      'Continue rotating your injection sites regularly.',
      'Check your injection sites for lumps (Lipohypertrophy).',
      'Inform the DVLA if you are a driver on insulin.'
    ],
    sickDaysNeeded: true
  },
  {
    code: '501',
    title: 'Mounjaro (Tirzepatide) - Starting Treatment',
    description: 'You are starting Mounjaro for type 2 diabetes. This medicine is also called tirzepatide. It helps improve blood sugar control and may also help with weight management.',
    badge: 'NEW',
    category: 'GLP-1 / GIP',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/medicines/tirzepatide-mounjaro/',
    trendLinks: [
      { title: 'GLP-1 RA and GIP guide', url: 'https://trenddiabetes.online/wp-content/uploads/2025/11/GLP1RA_TREND_FINAL.pdf' }
    ],
    keyInfo: [
      'Usually a once-weekly injection.',
      'May cause nausea or gastrointestinal side effects initially.',
      'Report any severe abdominal pain immediately.'
    ]
  },
  {
    code: '502',
    title: 'Mounjaro (Tirzepatide) - Reauthorisation',
    description: 'Your Mounjaro treatment has been reviewed and renewed. This medicine is also called tirzepatide. Keep taking it as advised and watch for side effects or dose changes.',
    badge: 'REAUTH',
    category: 'GLP-1 / GIP',
    reviewMonths: 12,
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
