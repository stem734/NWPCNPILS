export interface MedContent {
  code: string;
  title: string;
  description: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  category: string;
  keyInfoMode?: 'do' | 'dont';
  doKeyInfo?: string[];
  dontKeyInfo?: string[];
  generalKeyInfo?: string[];
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
    description: 'Sulfonylureas such as gliclazide and glimepiride help your body make more insulin to lower your blood sugar.',
    badge: 'NEW',
    category: 'Sulfonylureas',
    keyInfoMode: 'do',
    doKeyInfo: [
      'Take this medication with a meal.',
      'Be aware of "hypos" (low blood sugar).',
      'Always carry glucose or a sugary snack.'
    ],
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
    description: 'Sulfonylureas such as gliclazide and glimepiride remain an important part of blood sugar treatment by helping your body make more insulin.',
    badge: 'REAUTH',
    category: 'Sulfonylureas',
    keyInfoMode: 'do',
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
    description: 'SGLT2 inhibitors such as dapagliflozin and empagliflozin, which often end in "-gliflozin", help your body pass extra sugar in your urine.',
    badge: 'NEW',
    category: 'SGLT2 Inhibitors',
    keyInfoMode: 'do',
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
    description: 'SGLT2 inhibitors such as dapagliflozin and empagliflozin, which often end in "-gliflozin", can help lower blood sugar and may also protect your heart and kidneys.',
    badge: 'REAUTH',
    category: 'SGLT2 Inhibitors',
    keyInfoMode: 'do',
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
    description: 'Emollients such as Cetraben, Diprobase and E45 moisturise your skin and help soothe dryness and irritation.',
    badge: 'NEW',
    category: 'Dermatology',
    keyInfoMode: 'do',
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
    description: 'Emollients such as Cetraben, Diprobase and E45 help protect the skin barrier and soothe dryness when used regularly.',
    badge: 'REAUTH',
    category: 'Dermatology',
    keyInfoMode: 'do',
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
    description: 'Insulin treatments such as Levemir, Tresiba and Humulin help control your blood sugar and need careful day-to-day use.',
    badge: 'NEW',
    category: 'Insulin',
    keyInfoMode: 'do',
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
    description: 'Insulin treatments such as Levemir, Tresiba and Humulin remain an important part of blood sugar management and should be used in line with your insulin plan.',
    badge: 'REAUTH',
    category: 'Insulin',
    keyInfoMode: 'do',
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
    description: 'Mounjaro, also called tirzepatide, helps improve blood sugar control in type 2 diabetes and may also help with weight management.',
    badge: 'NEW',
    category: 'GLP-1 / GIP',
    keyInfoMode: 'do',
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
    description: 'Mounjaro, also called tirzepatide, supports blood sugar control in type 2 diabetes and should be monitored for side effects or dose changes.',
    badge: 'REAUTH',
    category: 'GLP-1 / GIP',
    keyInfoMode: 'do',
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
