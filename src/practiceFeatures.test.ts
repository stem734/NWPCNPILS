import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRACTICE_FEATURE_SETTINGS,
  coercePracticeFeatureSettings,
} from './practiceFeatures';

describe('coercePracticeFeatureSettings', () => {
  it('returns the default shape for non-object values', () => {
    expect(coercePracticeFeatureSettings(null)).toEqual(DEFAULT_PRACTICE_FEATURE_SETTINGS);
    expect(coercePracticeFeatureSettings(undefined)).toEqual(DEFAULT_PRACTICE_FEATURE_SETTINGS);
    expect(coercePracticeFeatureSettings('oops')).toEqual(DEFAULT_PRACTICE_FEATURE_SETTINGS);
  });

  it('treats medication_enabled as true unless explicitly false', () => {
    expect(coercePracticeFeatureSettings({}).medication_enabled).toBe(true);
    expect(coercePracticeFeatureSettings({ medication_enabled: false }).medication_enabled).toBe(
      false,
    );
    expect(coercePracticeFeatureSettings({ medication_enabled: true }).medication_enabled).toBe(
      true,
    );
  });

  it('treats optional features as disabled unless explicitly true', () => {
    const merged = coercePracticeFeatureSettings({
      healthcheck_enabled: true,
      screening_enabled: 'yes',
      immunisation_enabled: 1,
      ltc_enabled: true,
    });

    expect(merged.healthcheck_enabled).toBe(true);
    // Non-boolean truthy values must not flip the flag — guards against malformed API payloads.
    expect(merged.screening_enabled).toBe(false);
    expect(merged.immunisation_enabled).toBe(false);
    expect(merged.ltc_enabled).toBe(true);
  });
});
