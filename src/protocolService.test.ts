import { describe, expect, it } from 'vitest';
import { parseMedicationCodes } from './protocolService';

describe('parseMedicationCodes', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMedicationCodes('')).toEqual([]);
  });

  it('returns only valid 3-digit codes', () => {
    expect(parseMedicationCodes('100,200,300')).toEqual(['100', '200', '300']);
  });

  it('trims whitespace around codes', () => {
    expect(parseMedicationCodes(' 100 , 200 ')).toEqual(['100', '200']);
  });

  it('rejects codes that are not exactly 3 digits', () => {
    expect(parseMedicationCodes('1,22,333,4444,abc')).toEqual(['333']);
  });

  it('does not deduplicate codes (dedup is caller responsibility)', () => {
    expect(parseMedicationCodes('100,100,200')).toEqual(['100', '100', '200']);
  });
});
