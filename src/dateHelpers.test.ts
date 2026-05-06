import { describe, it, expect } from 'vitest';
import { parsePatientDate, isIssuedDateStale, parseSystmOneTimestamp, isUrlExpired } from './dateHelpers';

describe('parsePatientDate', () => {
  it('returns null for empty / null / whitespace input', () => {
    expect(parsePatientDate(null)).toBeNull();
    expect(parsePatientDate(undefined)).toBeNull();
    expect(parsePatientDate('')).toBeNull();
    expect(parsePatientDate('   ')).toBeNull();
  });

  it('parses DD/MM/YYYY (SystmOne default)', () => {
    const d = parsePatientDate('02/04/2026');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3); // April = index 3
    expect(d!.getDate()).toBe(2);
  });

  it('parses D/M/YYYY (single-digit day/month)', () => {
    const d = parsePatientDate('2/4/2026');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('parses DD.MM.YYYY (European locale)', () => {
    const d = parsePatientDate('02.04.2026');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('parses DD-MM-YYYY', () => {
    const d = parsePatientDate('02-04-2026');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('parses YYYY-MM-DD (ISO short)', () => {
    const d = parsePatientDate('2026-04-02');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('parses full ISO timestamp', () => {
    const d = parsePatientDate('2026-04-02T10:15:00Z');
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3);
    expect(d!.getUTCDate()).toBe(2);
  });

  it('parses DD-MMM-YYYY (named month)', () => {
    const d = parsePatientDate('02-Apr-2026');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('parses D MMM YYYY (space separated)', () => {
    const d = parsePatientDate('2 April 2026');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(2);
  });

  it('returns null for invalid calendar days', () => {
    expect(parsePatientDate('31/02/2026')).toBeNull();
    expect(parsePatientDate('32/01/2026')).toBeNull();
    expect(parsePatientDate('00/04/2026')).toBeNull();
    expect(parsePatientDate('2026-02-30')).toBeNull();
  });

  it('returns null for nonsense input', () => {
    expect(parsePatientDate('not a date')).toBeNull();
    expect(parsePatientDate('2026')).toBeNull();
    expect(parsePatientDate('04/2026')).toBeNull();
  });
});

describe('isIssuedDateStale', () => {
  const reference = new Date(2026, 3, 20); // 20 April 2026

  it('returns false when the date cannot be parsed', () => {
    expect(isIssuedDateStale('nonsense', 6, reference)).toBe(false);
    expect(isIssuedDateStale(null, 6, reference)).toBe(false);
  });

  it('returns false for a date newer than the threshold', () => {
    expect(isIssuedDateStale('01/03/2026', 6, reference)).toBe(false);
  });

  it('returns true for a date older than the threshold', () => {
    expect(isIssuedDateStale('01/01/2025', 6, reference)).toBe(true);
  });

  it('uses the custom monthsThreshold', () => {
    expect(isIssuedDateStale('01/03/2026', 1, reference)).toBe(true);
    expect(isIssuedDateStale('15/04/2026', 1, reference)).toBe(false);
  });

  it('works with a DD-MMM-YYYY SystmOne export', () => {
    expect(isIssuedDateStale('01-Jan-2025', 6, reference)).toBe(true);
    expect(isIssuedDateStale('01-Mar-2026', 6, reference)).toBe(false);
  });
});

describe('parseSystmOneTimestamp', () => {
  it('parses DD/MMM/YYYY HH:MM as the last codes segment', () => {
    const t = parseSystmOneTimestamp(',,?,,,,,,,06/May/2026 10:37');
    expect(t).not.toBeNull();
    expect(t!.getFullYear()).toBe(2026);
    expect(t!.getMonth()).toBe(4);
    expect(t!.getDate()).toBe(6);
    expect(t!.getHours()).toBe(10);
    expect(t!.getMinutes()).toBe(37);
  });

  it('returns null when no timestamp present', () => {
    expect(parseSystmOneTimestamp('code1,code2,code3')).toBeNull();
    expect(parseSystmOneTimestamp(null)).toBeNull();
    expect(parseSystmOneTimestamp('')).toBeNull();
  });

  it('parses a bare timestamp with no leading codes', () => {
    const t = parseSystmOneTimestamp('06/May/2026 10:37');
    expect(t).not.toBeNull();
    expect(t!.getHours()).toBe(10);
  });
});

describe('isUrlExpired', () => {
  it('returns true when timestamp is older than N weeks', () => {
    const timestamp = new Date(2026, 0, 1); // 1 Jan 2026
    const reference = new Date(2026, 0, 16); // 16 Jan 2026 (15 days later, > 2 weeks)
    expect(isUrlExpired(timestamp, 2, 'weeks', reference)).toBe(true);
  });

  it('returns false when timestamp is within N weeks', () => {
    const timestamp = new Date(2026, 0, 1);
    const reference = new Date(2026, 0, 8); // 7 days — exactly 1 week, not > 2 weeks
    expect(isUrlExpired(timestamp, 2, 'weeks', reference)).toBe(false);
  });

  it('returns true when timestamp is older than N months using calendar arithmetic', () => {
    const timestamp = new Date(2026, 0, 15); // 15 Jan 2026
    const reference = new Date(2026, 4, 1);  // 1 May 2026 (cutoff = 15 Apr, so clearly expired)
    expect(isUrlExpired(timestamp, 3, 'months', reference)).toBe(true);
  });

  it('returns false when timestamp is within N months', () => {
    const timestamp = new Date(2026, 0, 31); // 31 Jan 2026
    const reference = new Date(2026, 3, 1);  // 1 Apr 2026 (< 3 months: cutoff = 30 Apr)
    expect(isUrlExpired(timestamp, 3, 'months', reference)).toBe(false);
  });

  it('returns false exactly at the boundary', () => {
    const timestamp = new Date(2026, 0, 6, 10, 37);
    const reference = new Date(2026, 1, 6, 10, 37); // exactly 1 month later
    expect(isUrlExpired(timestamp, 1, 'months', reference)).toBe(false);
  });
});
