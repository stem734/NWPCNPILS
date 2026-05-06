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
  linkExpiryValue?: number;
  linkExpiryUnit?: 'weeks' | 'months';
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
  },
  {
    code: '601',
    title: 'Bisphosphonates - Starting Treatment',
    description: 'Bisphosphonates such as alendronate and risedronate help strengthen your bones and reduce the risk of fractures, particularly for osteoporosis.',
    badge: 'NEW',
    category: 'Bone Health',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/conditions/osteoporosis/treatment/',
    trendLinks: [],
    keyInfo: [
      'Take on an empty stomach with a full glass of water.',
      'Remain upright for at least 30 minutes after taking.',
      'Report any persistent jaw, ear, or muscle pain.'
    ]
  },
  {
    code: '602',
    title: 'Bisphosphonates - Reauthorisation',
    description: 'Bisphosphonates such as alendronate and risedronate continue to strengthen your bones and reduce fracture risk when taken as prescribed.',
    badge: 'REAUTH',
    category: 'Bone Health',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/conditions/osteoporosis/treatment/',
    trendLinks: [],
    keyInfo: [
      'Continue taking on an empty stomach with a full glass of water.',
      'Remain upright for at least 30 minutes after taking.',
      'Attend regular bone density checks as arranged.'
    ]
  },
  {
    code: '701',
    title: 'Valproate - Starting Treatment',
    description: 'Valproate (valproic acid) is used to treat epilepsy and help prevent seizures. It needs regular monitoring to ensure it is working safely.',
    badge: 'NEW',
    category: 'Neurological',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/medicines/valproic-acid/',
    trendLinks: [],
    keyInfo: [
      'Take as prescribed, usually with food to reduce stomach upset.',
      'Do not stop suddenly as this may increase seizure risk.',
      'Attend all blood tests to monitor liver function and blood counts.'
    ]
  },
  {
    code: '702',
    title: 'Valproate - Reauthorisation',
    description: 'Valproate (valproic acid) continues to help control epilepsy and prevent seizures. Regular monitoring is essential for safe treatment.',
    badge: 'REAUTH',
    category: 'Neurological',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/medicines/valproic-acid/',
    trendLinks: [],
    keyInfo: [
      'Continue taking as prescribed, usually with food.',
      'Do not stop suddenly as this may increase seizure risk.',
      'Continue attending blood tests to monitor liver function and blood counts.'
    ]
  },
  {
    code: '801',
    title: 'Topiramate - Starting Treatment',
    description: 'Topiramate is used to treat epilepsy to help prevent seizures, and may also be used for migraine prevention. Regular check-ups are important.',
    badge: 'NEW',
    category: 'Neurological',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/medicines/topiramate/',
    trendLinks: [],
    keyInfo: [
      'Take as prescribed, usually once or twice daily.',
      'Drink plenty of water to help prevent kidney stones.',
      'Avoid sudden stopping as this may trigger seizures.'
    ]
  },
  {
    code: '802',
    title: 'Topiramate - Reauthorisation',
    description: 'Topiramate continues to help prevent seizures or migraines when taken as prescribed. Ongoing monitoring ensures the treatment remains safe and effective.',
    badge: 'REAUTH',
    category: 'Neurological',
    keyInfoMode: 'do',
    reviewMonths: 12,
    nhsLink: 'https://www.nhs.uk/medicines/topiramate/',
    trendLinks: [],
    keyInfo: [
      'Continue taking as prescribed, usually once or twice daily.',
      'Continue drinking plenty of water to help prevent kidney stones.',
      'Do not stop suddenly as this may trigger seizures or migraines.'
    ]
  }
];

export const MED_MAP: Record<string, MedContent> = Object.fromEntries(
  MEDICATIONS.map(m => [m.code, m])
);
