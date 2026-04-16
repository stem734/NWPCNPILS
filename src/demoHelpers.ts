type DemoVariation = {
  forename: string;
  practiceName: string;
  nhsNumber: string;
  codes: string;
};

export const DEMO_VARIATIONS: DemoVariation[] = [
  {
    forename: 'Steve',
    practiceName: 'Nottingham West GP Practices',
    nhsNumber: '9990000001',
    codes: '101,302',
  },
  {
    forename: 'Anna',
    practiceName: 'Nottingham West GP Practices',
    nhsNumber: '9990000002',
    codes: '201,202',
  },
  {
    forename: 'James',
    practiceName: 'Bramcote Surgery',
    nhsNumber: '9990000003',
    codes: '401,402',
  },
  {
    forename: 'Priya',
    practiceName: 'Stapleford Health Centre',
    nhsNumber: '9990000004',
    codes: '101,201,302',
  },
  {
    forename: 'Dawn',
    practiceName: 'Nottingham West GP Practices',
    nhsNumber: '9990000005',
    codes: '501,502',
  },
];

export const getRandomDemoVariation = (): DemoVariation => {
  const index = Math.floor(Math.random() * DEMO_VARIATIONS.length);
  return DEMO_VARIATIONS[index];
};

export const buildDemoPatientUrl = (variation: DemoVariation) =>
  `/patient?org=${encodeURIComponent(variation.practiceName)}&forename=${encodeURIComponent(variation.forename)}&nhs_number=${encodeURIComponent(variation.nhsNumber)}&codes=${encodeURIComponent(variation.codes)}`;

export const getDemoNoticeText = () =>
  'This is dummy information only and should not be used for clinical decisions.';
