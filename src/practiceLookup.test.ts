import { describe, expect, it } from 'vitest';
import { getPracticeLookupFromSearchParams } from './practiceLookup';

describe('getPracticeLookupFromSearchParams', () => {
  it('uses the organisation name when no ODS code is present', () => {
    const lookup = getPracticeLookupFromSearchParams(new URLSearchParams({ org: ' Riverside Medical Centre ' }));

    expect(lookup).toEqual({
      orgName: 'Riverside Medical Centre',
      odsCode: '',
      lookupValue: 'Riverside Medical Centre',
      cacheKey: 'org:riverside medical centre',
      hasIdentifier: true,
    });
  });

  it('prefers a normalised ODS code for practice lookup', () => {
    const lookup = getPracticeLookupFromSearchParams(new URLSearchParams({
      org: 'Riverside Medical Centre',
      ods: ' c84001 ',
    }));

    expect(lookup.orgName).toBe('Riverside Medical Centre');
    expect(lookup.odsCode).toBe('C84001');
    expect(lookup.lookupValue).toBe('C84001');
    expect(lookup.cacheKey).toBe('ods:c84001');
  });

  it('supports compatibility aliases for the ODS URL parameter', () => {
    expect(getPracticeLookupFromSearchParams(new URLSearchParams({ odsCode: 'A12345' })).lookupValue).toBe('A12345');
    expect(getPracticeLookupFromSearchParams(new URLSearchParams({ ods_code: 'B12345' })).lookupValue).toBe('B12345');
    expect(getPracticeLookupFromSearchParams(new URLSearchParams({ practiceOds: 'C12345' })).lookupValue).toBe('C12345');
  });
});
