export type PreviewStatus = 'ok' | 'amber' | 'red';

export interface PreviewMetric {
  label: string;
  value: string;
  unit?: string;
  badge: string;
  badgeClass: PreviewStatus;
  pathway: string;
  breakdown?: { label: string; value: string; unit?: string }[];
  oneLiner?: string;
}

export interface PreviewDomainConfig {
  heading: string;
  subheading: string;
  whatIsTitle: string;
  whatIsText: string;
  metricByCode: Record<string, PreviewMetric>;
  defaultMetric: PreviewMetric;
  defaultImportantText?: string;
  actions: string[];
  defaultNextStepsTitle: string;
  defaultNextStepsText: string;
}

export const CLINICAL_DOMAIN_IDS = ['bp', 'bmi', 'cvd', 'ldl', 'hba1c', 'act', 'alc', 'smk'] as const;

export type ClinicalDomainId = typeof CLINICAL_DOMAIN_IDS[number];

export const PREVIEW_DOMAIN_CONFIGS: Record<ClinicalDomainId, PreviewDomainConfig> = {
  bp: {
    heading: 'Blood pressure check',
    subheading: 'Showing the result card and follow-up steps for blood pressure.',
    whatIsTitle: 'What is blood pressure?',
    whatIsText: 'Blood pressure is the force of blood pushing against the walls of your arteries. It is written as two numbers, for example 120/80.',
    metricByCode: {
      BPNORMAL: { label: 'Blood Pressure (BP)', value: '138/88', unit: 'mmHg', badge: 'HEALTHY', badgeClass: 'ok', pathway: 'Your blood pressure is within a healthy range.' },
      BPRAISED1: { label: 'Blood Pressure (BP)', value: '148/92', unit: 'mmHg', badge: 'HIGH', badgeClass: 'red', pathway: 'Your blood pressure is high and needs attention. Follow the advice provided with your health check.' },
    },
    defaultMetric: { label: 'Blood Pressure (BP)', value: '148/92', unit: 'mmHg', badge: 'HIGH', badgeClass: 'red', pathway: 'Your blood pressure is high and needs attention. Follow the advice provided with your health check.' },
    actions: ['View blood pressure advice'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'Blood pressure is recorded and the patient should be advised what the result means, what action is needed, and when to recheck.',
  },
  bmi: {
    heading: 'Weight management review',
    subheading: 'Showing the result card and support options for body mass index.',
    whatIsTitle: 'What is BMI?',
    whatIsText: 'BMI stands for body mass index. It compares your weight and height to give a rough guide to whether your weight is in a healthy range.',
    metricByCode: {
      BMINORMAL: { label: 'Body Mass Index (BMI)', value: '22.4', unit: 'kg/m²', badge: 'HEALTHY', badgeClass: 'ok', pathway: 'Your BMI is within a healthy range.' },
      BMI1: { label: 'Body Mass Index (BMI)', value: '27.1', unit: 'kg/m²', badge: 'OVERWEIGHT', badgeClass: 'amber', pathway: 'Your BMI is in the 25 to 29.9 range and indicates you are overweight.' },
      BMI2: { label: 'Body Mass Index (BMI)', value: '34.2', unit: 'kg/m²', badge: 'OBESE', badgeClass: 'red', pathway: 'Your BMI is in the 30 to 39.9 range and indicates obesity.' },
      BMI3: { label: 'Body Mass Index (BMI)', value: '42.1', unit: 'kg/m²', badge: 'SEVERE OBESITY', badgeClass: 'red', pathway: 'Your BMI is 40 or above and indicates severe obesity.' },
    },
    defaultMetric: { label: 'Body Mass Index (BMI)', value: '28.5', unit: 'kg/m²', badge: 'OVERWEIGHT', badgeClass: 'amber', pathway: 'Your BMI indicates you are overweight. Referral to a local NHS weight management group is available.' },
    actions: ['Refer to weight management', 'Read healthy weight guidance'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'BMI should show the latest available value and explain whether the patient should be offered weight management support.',
  },
  cvd: {
    heading: 'Cardiovascular risk',
    subheading: 'Showing the result card and follow-up steps for heart health risk.',
    whatIsTitle: 'What is QRisk?',
    whatIsText: 'QRisk is an estimate of your chance of having a heart attack or stroke in the next 10 years.',
    metricByCode: {
      QRISKLOW: { label: 'CVD Risk (10yr)', value: '8.1', unit: '%', badge: 'LOW RISK', badgeClass: 'ok', pathway: 'Your cardiovascular risk is below 10% and is classed as low risk.' },
      QRISKHIGH: { label: 'CVD Risk (10yr)', value: '12.6', unit: '%', badge: 'HIGH RISK', badgeClass: 'red', pathway: 'Your cardiovascular risk is 10% or above. Follow the advice provided with your health check.' },
    },
    defaultMetric: { label: 'CVD Risk (10yr)', value: '13.8', unit: '%', badge: 'MODERATE', badgeClass: 'amber', pathway: 'Your cardiovascular risk is moderate. Focus on heart-healthy lifestyle changes.' },
    actions: ['Improve heart health'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'QRisk should show the latest 10-year risk and explain the patient’s heart and stroke risk in plain English.',
  },
  ldl: {
    heading: 'Shared cholesterol review',
    subheading: 'Showing the shared cholesterol card with LDL, HDL and total cholesterol values.',
    whatIsTitle: 'What is cholesterol?',
    whatIsText: 'Cholesterol is a fat-like substance in your blood. Your results usually include total cholesterol, LDL, and HDL, which are used together to assess risk.',
    metricByCode: {
      CHOLNORMAL: {
        label: 'Cholesterol',
        value: '4.7',
        unit: 'mmol/L',
        badge: 'HEALTHY',
        badgeClass: 'ok',
        pathway: 'Your cholesterol results are in the normal range for this check.',
        breakdown: [
          { label: 'HDL', value: '1.2', unit: 'mmol/L' },
          { label: 'LDL', value: '2.8', unit: 'mmol/L' },
          { label: 'Total', value: '4.7', unit: 'mmol/L' },
        ],
        oneLiner: 'HDL is often called "good" cholesterol and LDL "bad" cholesterol. Together with your total cholesterol, they help assess your heart and stroke risk.',
      },
      CHOLREVIEW: {
        label: 'Cholesterol',
        value: '5.6',
        unit: 'mmol/L',
        badge: 'REVIEW',
        badgeClass: 'amber',
        pathway: 'Your cholesterol results fall into the review range for this check.',
        breakdown: [
          { label: 'HDL', value: '1.0', unit: 'mmol/L' },
          { label: 'LDL', value: '3.7', unit: 'mmol/L' },
          { label: 'Total', value: '5.6', unit: 'mmol/L' },
        ],
        oneLiner: 'HDL is often called "good" cholesterol and LDL "bad" cholesterol. Together with your total cholesterol, they help assess your heart and stroke risk.',
      },
    },
    defaultMetric: {
      label: 'Cholesterol',
      value: '5.6',
      unit: 'mmol/L',
      badge: 'REVIEW',
      badgeClass: 'amber',
      pathway: 'Your cholesterol results are raised and may need follow-up. Follow the advice provided with your health check.',
      breakdown: [
        { label: 'HDL', value: '1.0', unit: 'mmol/L' },
        { label: 'LDL', value: '3.7', unit: 'mmol/L' },
        { label: 'Total', value: '5.6', unit: 'mmol/L' },
      ],
      oneLiner: 'HDL is often called "good" cholesterol and LDL "bad" cholesterol. Together with your total cholesterol, they help assess your heart and stroke risk.',
    },
    actions: ['Read cholesterol advice'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'Use one shared cholesterol block for LDL, HDL and total cholesterol. Add short text explaining what is raised and what follow-up is needed.',
  },
  hba1c: {
    heading: 'Diabetes risk review',
    subheading: 'Showing the result card and support options for blood sugar risk.',
    whatIsTitle: 'What is HbA1c?',
    whatIsText: 'HbA1c is a blood test that shows your average blood sugar over the last 2 to 3 months.',
    metricByCode: {
      HBA1CNORMAL: { label: 'HbA1c', value: '39', unit: 'mmol/mol', badge: 'HEALTHY', badgeClass: 'ok', pathway: 'Your HbA1c is below 42 and is in the normal range.' },
      HBA1CNDH1: { label: 'HbA1c', value: '45', unit: 'mmol/mol', badge: 'PREDIABETES', badgeClass: 'amber', pathway: 'Your HbA1c is between 42 and 47 and is in the raised range.' },
      HBA1CDM: { label: 'HbA1c', value: '52', unit: 'mmol/mol', badge: 'DIABETIC RANGE', badgeClass: 'red', pathway: 'Your HbA1c is 48 or above and is in the diabetes range.' },
    },
    defaultMetric: { label: 'HbA1c', value: '45', unit: 'mmol/mol', badge: 'PREDIABETES', badgeClass: 'amber', pathway: 'Your HbA1c is slightly raised. Small changes to diet and activity can help reduce your diabetes risk.' },
    actions: ['Join diabetes prevention', 'Improve diet and activity'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'HbA1c should show whether the patient is normal, raised or in the diabetes range, with plain-language guidance.',
  },
  act: {
    heading: 'Activity support',
    subheading: 'Showing the result card and practical ways to get moving.',
    whatIsTitle: 'What is physical activity?',
    whatIsText: 'Physical activity includes any movement that gets your body working, from walking and gardening to sport and exercise.',
    metricByCode: {
      GPPAQACTIVE: { label: 'Physical Activity', value: 'Active', badge: 'ACTIVE', badgeClass: 'ok', pathway: 'You are meeting the recommended 150 minutes of activity per week. Keep it up!' },
      GPPAQMODACTIVE: { label: 'Physical Activity', value: 'Moderately active', badge: 'LOW', badgeClass: 'amber', pathway: 'You are below the recommended 150 minutes of activity per week. Try adding short walks to your daily routine.' },
      GPPAQFAIRINACTIVE: { label: 'Physical Activity', value: 'Fairly inactive', badge: 'LOW', badgeClass: 'amber', pathway: 'You are below the recommended 150 minutes of activity per week. Try adding short walks to your daily routine.' },
      GPPAQINACTIVE: { label: 'Physical Activity', value: 'Inactive', badge: 'INACTIVE', badgeClass: 'red', pathway: 'Increasing physical activity would significantly improve your health. Consider local support to help you get started.' },
      GPPAQUNABLE: { label: 'Physical Activity', value: 'Unable', badge: 'UNABLE', badgeClass: 'amber', pathway: 'Physical activity support should be tailored to what feels manageable for you.' },
    },
    defaultMetric: { label: 'Physical Activity', value: 'Low activity', badge: 'INACTIVE', badgeClass: 'red', pathway: 'You are doing too little physical activity. Starting with short daily walks can help improve your health.' },
    actions: ['Start with short walks', 'Find local activity support'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'Physical activity should be shown as a simple code and the patient should be told whether they are active, inactive or unable to exercise.',
  },
  alc: {
    heading: 'Alcohol support',
    subheading: 'Showing the result card and simple steps to cut down safely.',
    whatIsTitle: 'What is alcohol risk?',
    whatIsText: 'Alcohol risk looks at how much you drink and whether it is likely to affect your health or put you above recommended limits.',
    metricByCode: {
      ALCRISKATRISK: { label: 'Alcohol Use', value: '16 Units', badge: 'HIGH RISK', badgeClass: 'red', pathway: 'Your alcohol intake is high and affecting your health. Please discuss support options with your GP.' },
      ALCRISKTOOMUCH: { label: 'Alcohol Use', value: '20 Units', badge: 'REVIEW', badgeClass: 'amber', pathway: 'Your alcohol intake is above recommended levels. Try to have at least 3 alcohol-free days per week.' },
      ALCRISKTOOMUCH1: { label: 'Alcohol Use', value: '20 Units', badge: 'REVIEW', badgeClass: 'amber', pathway: 'Your alcohol intake is above recommended levels. Try to have at least 3 alcohol-free days per week.' },
      ALCRISKOK: { label: 'Alcohol Use', value: '8 Units', badge: 'LOW RISK', badgeClass: 'ok', pathway: 'Your alcohol intake is within recommended guidelines (under 14 units per week).' },
      ALCRISKTEETOTAL: { label: 'Alcohol Use', value: 'Teetotal', badge: 'LOW RISK', badgeClass: 'ok', pathway: 'You do not drink alcohol, which means your alcohol risk is low.' },
    },
    defaultMetric: { label: 'Alcohol Use', value: '20 Units', badge: 'MODERATE', badgeClass: 'amber', pathway: 'Your alcohol intake is above the recommended level. Reducing units can improve sleep, weight, and blood pressure.' },
    actions: ['Reduce weekly units', 'View alcohol advice'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'Alcohol risk should explain whether intake is OK, at risk, or above recommended levels.',
  },
  smk: {
    heading: 'Smoking cessation',
    subheading: 'Showing the result card and quit-smoking support.',
    whatIsTitle: 'What is smoking status?',
    whatIsText: 'Smoking status tells us whether you currently smoke, have stopped, or do not smoke.',
    metricByCode: {
      SMOKNONSMOK: { label: 'Smoking Status', value: 'Non-smoker', badge: 'NON-SMOKER', badgeClass: 'ok', pathway: 'Well done — not smoking is one of the best things you can do for your health.' },
      SMOKSTOPPED: { label: 'Smoking Status', value: 'Stopped smoking', badge: 'EX-SMOKER', badgeClass: 'amber', pathway: 'Well done for quitting. Your health risk continues to fall the longer you stay smoke-free.' },
      SMOKCURRSMOK: { label: 'Smoking Status', value: 'Current smoker', badge: 'SMOKER', badgeClass: 'red', pathway: 'Smoking is the biggest single risk to your health. Support is available to help you quit.' },
    },
    defaultMetric: { label: 'Smoking Status', value: 'Current smoker', badge: 'SMOKER', badgeClass: 'red', pathway: 'Smoking is the biggest single risk to your health. Support is available to help you quit.' },
    actions: ['Get quit support', 'Book smoking advice'],
    defaultNextStepsTitle: 'What to do next',
    defaultNextStepsText: 'Smoking status should clearly tell the patient if they smoke, have stopped, or do not smoke.',
  },
};
