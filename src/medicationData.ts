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
    title: 'Sulfonylurea medicines, such as gliclazide or glimepiride - Starting Treatment',
    description: 'You are starting a sulfonylurea medicine, such as gliclazide or glimepiride. These medicines help your body produce more insulin to lower blood glucose.',
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
    title: 'Sulfonylurea medicines, such as gliclazide or glimepiride - Reauthorisation',
    description: 'Your sulfonylurea medicine, such as gliclazide or glimepiride, has been reviewed and reauthorised for another year. It continues to be an important part of your glucose management.',
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
    title: 'SGLT2 inhibitor medicines, such as dapagliflozin or empagliflozin - Starting Treatment',
    description: 'You are starting an SGLT2 inhibitor medicine, such as dapagliflozin or empagliflozin. Many of these medicine names end in "-gliflozin". They help your kidneys remove excess sugar through your urine.',
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
    title: 'SGLT2 inhibitor medicines, such as dapagliflozin or empagliflozin - Reauthorisation',
    description: 'Your SGLT2 inhibitor medicine, such as dapagliflozin or empagliflozin, has been reviewed and reauthorised. Many of these medicine names end in "-gliflozin". This treatment can help protect your heart and kidneys.',
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
    title: 'Emollients and skin care, such as Cetraben, Diprobase or E45 - Starting Treatment',
    description: 'You are starting an emollient and skin care treatment, such as Cetraben, Diprobase or E45. Emollients are moisturising treatments applied directly to the skin to soothe it and hydrate it.',
    badge: 'NEW',
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
    code: '302',
    title: 'Emollients and skin care, such as Cetraben, Diprobase or E45 - Reauthorisation',
    description: 'Your emollient and skin care treatment, such as Cetraben, Diprobase or E45, has been reviewed and reauthorised. Continue using it regularly to help protect and soothe your skin.',
    badge: 'REAUTH',
    category: 'Dermatology',
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
    title: 'Insulin therapy, such as Levemir, Tresiba or Humulin - Starting Treatment',
    description: 'You are starting insulin therapy, such as Levemir, Tresiba or Humulin. Insulin is a vital hormone for managing your blood glucose levels and this information will help you begin treatment safely.',
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
    code: '402',
    title: 'Insulin therapy, such as Levemir, Tresiba or Humulin - Reauthorisation',
    description: 'Your insulin therapy, such as Levemir, Tresiba or Humulin, has been reviewed and reauthorised. Continue following your insulin plan and regular monitoring advice.',
    badge: 'REAUTH',
    category: 'Insulin',
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
    description: 'You are starting Mounjaro for Type 2 Diabetes. This medicine mimics hormones to improve blood sugar control and support weight management.',
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
  },
  {
    code: '502',
    title: 'Mounjaro (Tirzepatide) - Reauthorisation',
    description: 'Your Mounjaro treatment has been reviewed and reauthorised. Continue taking it as advised and keep monitoring for side effects or dose changes.',
    badge: 'REAUTH',
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
