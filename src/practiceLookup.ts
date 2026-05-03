const PRACTICE_ODS_PARAM_NAMES = ['ods', 'odsCode', 'ods_code', 'practiceOds'];

export type PracticeLookup = {
  orgName: string;
  odsCode: string;
  lookupValue: string;
  cacheKey: string;
  hasIdentifier: boolean;
};

export function getPracticeLookupFromSearchParams(params: URLSearchParams): PracticeLookup {
  const orgName = (params.get('org') || '').trim();
  const odsCode = PRACTICE_ODS_PARAM_NAMES
    .map((paramName) => (params.get(paramName) || '').trim().toUpperCase())
    .find(Boolean) || '';
  const lookupValue = odsCode || orgName;

  return {
    orgName,
    odsCode,
    lookupValue,
    cacheKey: `${odsCode ? 'ods' : 'org'}:${lookupValue.toLowerCase()}`,
    hasIdentifier: lookupValue.length > 0,
  };
}
