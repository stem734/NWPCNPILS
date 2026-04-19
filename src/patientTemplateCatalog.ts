export type PatientResourceLink = {
  title: string;
  url: string;
  description: string;
};

export type ScreeningTemplate = {
  id: string;
  label: string;
  headline: string;
  explanation: string;
  guidance: string[];
  nhsLinks: PatientResourceLink[];
};

export type ImmunisationTemplate = {
  id: string;
  label: string;
  headline: string;
  explanation: string;
  guidance: string[];
  nhsLinks: PatientResourceLink[];
};

export const SCREENING_TEMPLATES: Record<string, ScreeningTemplate> = {
  cervical: {
    id: 'cervical',
    label: 'Cervical screening',
    headline: 'Cervical screening helps prevent cervical cancer.',
    explanation:
      'Cervical screening checks for HPV and cell changes that could lead to cancer in the future. It does not test for cancer itself.',
    guidance: [
      'Book your appointment when invited, even if you feel well.',
      'Most people have normal results and are invited again later.',
      'If follow-up is needed, your GP practice will explain the next step.',
    ],
    nhsLinks: [
      {
        title: 'NHS cervical screening overview',
        url: 'https://www.nhs.uk/conditions/cervical-screening/',
        description: 'What cervical screening is, who it is for, and what your results mean.',
      },
      {
        title: 'How cervical screening is done',
        url: 'https://www.nhs.uk/conditions/cervical-screening/what-happens/',
        description: 'Step-by-step guide to the appointment and what to expect.',
      },
    ],
  },
  bowel: {
    id: 'bowel',
    label: 'Bowel screening',
    headline: 'Bowel screening checks for signs that may need further tests.',
    explanation:
      'The NHS bowel screening programme uses a home test kit to look for hidden blood in your stool.',
    guidance: [
      'Complete and return your kit as soon as possible after it arrives.',
      'A positive result does not mean you have cancer, but more checks are needed.',
      'If symptoms change, contact your GP without waiting for routine screening.',
    ],
    nhsLinks: [
      {
        title: 'NHS bowel cancer screening',
        url: 'https://www.nhs.uk/conditions/bowel-cancer-screening/',
        description: 'Who is invited, how to use the kit, and understanding results.',
      },
      {
        title: 'Bowel cancer symptoms',
        url: 'https://www.nhs.uk/conditions/bowel-cancer/',
        description: 'Symptoms to watch for and when to seek urgent advice.',
      },
    ],
  },
  breast: {
    id: 'breast',
    label: 'Breast screening',
    headline: 'Breast screening uses X-rays (mammograms) to find changes early.',
    explanation:
      'Screening can detect breast cancer before symptoms appear, when treatment may be more effective.',
    guidance: [
      'Attend your mammogram appointment when invited.',
      'You may be asked to return for extra images, which is common.',
      'Continue to check your breasts and report new changes to your GP.',
    ],
    nhsLinks: [
      {
        title: 'NHS breast screening',
        url: 'https://www.nhs.uk/conditions/breast-screening-mammogram/',
        description: 'How mammograms work and what happens next.',
      },
      {
        title: 'Breast cancer symptoms',
        url: 'https://www.nhs.uk/conditions/breast-cancer/',
        description: 'Common symptoms and when to contact your GP.',
      },
    ],
  },
  aaa: {
    id: 'aaa',
    label: 'AAA screening',
    headline: 'AAA screening checks for swelling in the main blood vessel in your abdomen.',
    explanation:
      'Abdominal aortic aneurysm screening is usually offered to men at age 65 to detect aneurysms early.',
    guidance: [
      'Attend your scan appointment even if you have no symptoms.',
      'Most people have a normal result and need no further scans.',
      'If monitoring is needed, follow-up scans are arranged by the NHS programme.',
    ],
    nhsLinks: [
      {
        title: 'NHS AAA screening programme',
        url: 'https://www.nhs.uk/conditions/abdominal-aortic-aneurysm-screening/',
        description: 'Who is invited, scan process, and result pathways.',
      },
      {
        title: 'Abdominal aortic aneurysm information',
        url: 'https://www.nhs.uk/conditions/abdominal-aortic-aneurysm/',
        description: 'Symptoms, treatment, and when to seek urgent care.',
      },
    ],
  },
  diabetic_eye: {
    id: 'diabetic_eye',
    label: 'Diabetic eye screening',
    headline: 'Diabetic eye screening checks for changes caused by diabetes.',
    explanation:
      'The screening test looks for diabetic retinopathy, which can damage sight if not treated early.',
    guidance: [
      'Attend annual eye screening when invited.',
      'Bring sunglasses as drops can blur vision for a few hours.',
      'Keep blood sugar, blood pressure, and cholesterol controlled to protect your eyes.',
    ],
    nhsLinks: [
      {
        title: 'NHS diabetic eye screening',
        url: 'https://www.nhs.uk/conditions/diabetic-eye-screening/',
        description: 'What happens during screening and what the results mean.',
      },
      {
        title: 'Diabetic retinopathy',
        url: 'https://www.nhs.uk/conditions/diabetic-retinopathy/',
        description: 'How diabetes can affect your eyes and treatment options.',
      },
    ],
  },
};

export const IMMUNISATION_TEMPLATES: Record<string, ImmunisationTemplate> = {
  flu: {
    id: 'flu',
    label: 'Flu vaccine',
    headline: 'The flu vaccine lowers your risk of serious flu illness.',
    explanation:
      'Flu strains change each year, so the vaccine is updated and usually offered every autumn/winter.',
    guidance: [
      'A sore arm and mild temperature are common and usually settle quickly.',
      'Seek urgent help for severe allergic symptoms such as breathing difficulty.',
      'Continue good hand hygiene and stay home if unwell.',
    ],
    nhsLinks: [
      {
        title: 'NHS flu vaccine',
        url: 'https://www.nhs.uk/vaccinations/flu-vaccine/',
        description: 'Eligibility, side effects, and how to book.',
      },
    ],
  },
  covid: {
    id: 'covid',
    label: 'COVID-19 vaccine',
    headline: 'COVID-19 vaccination helps protect against severe illness.',
    explanation:
      'Protection can reduce over time, so seasonal booster programmes target people at higher risk.',
    guidance: [
      'Common side effects include tiredness, headache, and arm pain.',
      'Most symptoms improve within 1 to 2 days.',
      'Follow public health advice if you develop respiratory symptoms.',
    ],
    nhsLinks: [
      {
        title: 'NHS COVID-19 vaccine',
        url: 'https://www.nhs.uk/vaccinations/covid-19-vaccine/',
        description: 'Current eligibility, booking, and side effect guidance.',
      },
    ],
  },
  shingles: {
    id: 'shingles',
    label: 'Shingles vaccine',
    headline: 'Shingles vaccination reduces your chance of shingles and complications.',
    explanation:
      'Shingles can cause long-lasting nerve pain. Vaccination is offered to older adults and eligible risk groups.',
    guidance: [
      'Mild side effects are common and usually short-lived.',
      'Contact your GP if you develop a painful blistering rash.',
      'Pain persisting after shingles should be reviewed promptly.',
    ],
    nhsLinks: [
      {
        title: 'NHS shingles vaccine',
        url: 'https://www.nhs.uk/vaccinations/shingles-vaccine/',
        description: 'Who can have it, how it works, and side effects.',
      },
    ],
  },
  pneumo: {
    id: 'pneumo',
    label: 'Pneumococcal vaccine',
    headline: 'Pneumococcal vaccination helps protect against serious infections.',
    explanation:
      'It protects against illnesses such as pneumonia, meningitis, and bloodstream infection caused by pneumococcal bacteria.',
    guidance: [
      'A sore arm and mild fever can happen after vaccination.',
      'Speak to your GP if you are unsure whether you need a booster.',
      'Seek urgent care if you feel very unwell after vaccination.',
    ],
    nhsLinks: [
      {
        title: 'NHS pneumococcal vaccine',
        url: 'https://www.nhs.uk/vaccinations/pneumococcal-vaccine/',
        description: 'Eligibility, schedules, and aftercare advice.',
      },
    ],
  },
  pertussis: {
    id: 'pertussis',
    label: 'Whooping cough vaccine (pregnancy)',
    headline: 'Pertussis vaccination in pregnancy protects newborn babies.',
    explanation:
      'Vaccination in pregnancy helps pass antibodies to your baby before birth.',
    guidance: [
      'The vaccine is usually offered from around 16 weeks in pregnancy.',
      'A sore arm is common after injection.',
      'Contact your maternity team with any concerns after vaccination.',
    ],
    nhsLinks: [
      {
        title: 'NHS whooping cough vaccine in pregnancy',
        url: 'https://www.nhs.uk/pregnancy/keeping-well/whooping-cough-vaccination/',
        description: 'When to have it and how it protects your baby.',
      },
    ],
  },
  mmr: {
    id: 'mmr',
    label: 'MMR vaccine',
    headline: 'MMR protects against measles, mumps and rubella.',
    explanation:
      'Two doses provide strong protection and help prevent outbreaks in the community.',
    guidance: [
      'Mild fever or rash can happen after vaccination.',
      'Check your records if you are unsure whether two doses were given.',
      'Seek medical advice if severe symptoms occur after vaccination.',
    ],
    nhsLinks: [
      {
        title: 'NHS MMR vaccine',
        url: 'https://www.nhs.uk/vaccinations/mmr-vaccine/',
        description: 'Who should get MMR and what side effects to expect.',
      },
    ],
  },
  hpv: {
    id: 'hpv',
    label: 'HPV vaccine',
    headline: 'HPV vaccination helps prevent cancers caused by HPV.',
    explanation:
      'The vaccine protects against types of HPV linked to cervical and other cancers.',
    guidance: [
      'The vaccine works best before exposure to HPV.',
      'Mild side effects such as arm pain are common and short-lived.',
      'Continue cervical screening invitations when eligible, even after vaccination.',
    ],
    nhsLinks: [
      {
        title: 'NHS HPV vaccine',
        url: 'https://www.nhs.uk/vaccinations/hpv-vaccine/',
        description: 'Eligibility, dose schedule, and long-term protection.',
      },
    ],
  },
};

