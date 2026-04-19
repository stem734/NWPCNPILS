export type HealthCheckCodeFamily =
  | 'bp'
  | 'bmi'
  | 'cvd'
  | 'chol'
  | 'hba1c'
  | 'act'
  | 'alc'
  | 'smk';

export type HealthCheckCodeValue = string;

export type HealthCheckCodeMap = Record<HealthCheckCodeFamily, HealthCheckCodeValue[]>;

export const HEALTH_CHECK_CODE_VALUES: HealthCheckCodeMap = {
  bp: ['BPNORMAL', 'BPRAISED1'],
  bmi: ['BMINORMAL', 'BMI1', 'BMI2', 'BMI3'],
  cvd: ['QRISKLOW', 'QRISKHIGH'],
  chol: ['CHOLNORMAL', 'CHOLREVIEW'],
  hba1c: ['HBA1CNDH1', 'HBA1CNORMAL', 'HBA1CDM'],
  act: ['GPPAQACTIVE', 'GPPAQINACTIVE', 'GPPAQMODACTIVE', 'GPPAQFAIRINACTIVE', 'GPPAQUNABLE'],
  alc: ['ALCRISKATRISK', 'ALCRISKTOOMUCH', 'ALCRISKTOOMUCH1', 'ALCRISKOK', 'ALCRISKTEETOTAL'],
  smk: ['SMOKNONSMOK', 'SMOKSTOPPED', 'SMOKCURRSMOK'],
};

export const HEALTH_CHECK_CODE_HINTS: Record<HealthCheckCodeFamily, string[]> = {
  bp: ['BPNORMAL', 'BPRAISED1'],
  bmi: ['BMINORMAL', 'BMI1', 'BMI2', 'BMI3'],
  cvd: ['QRISKLOW', 'QRISKHIGH'],
  chol: ['CHOLNORMAL', 'CHOLREVIEW'],
  hba1c: ['HBA1CNORMAL', 'HBA1CNDH1', 'HBA1CDM'],
  act: ['GPPAQACTIVE', 'GPPAQMODACTIVE', 'GPPAQFAIRINACTIVE', 'GPPAQINACTIVE', 'GPPAQUNABLE'],
  alc: ['ALCRISKATRISK', 'ALCRISKTOOMUCH', 'ALCRISKTOOMUCH1', 'ALCRISKOK', 'ALCRISKTEETOTAL'],
  smk: ['SMOKNONSMOK', 'SMOKSTOPPED', 'SMOKCURRSMOK'],
};

export const HEALTH_CHECK_CARD_LABELS: Record<HealthCheckCodeFamily, string> = {
  bp: 'Blood Pressure',
  bmi: 'Body Mass Index',
  cvd: 'QRisk / CVD',
  chol: 'Cholesterol',
  hba1c: 'HbA1c',
  act: 'Physical Activity',
  alc: 'Alcohol',
  smk: 'Smoking',
};
