import { describe, expect, it } from 'vitest';
import {
  SCREENING_TEMPLATES,
  findScreeningTemplateByIdentifier,
  withScreeningTemplateDefaults,
} from './patientTemplateCatalog';

describe('screening template identifier resolution', () => {
  const templates = Object.values(SCREENING_TEMPLATES).map(withScreeningTemplateDefaults);

  it('resolves a screening template by legacy id', () => {
    const template = findScreeningTemplateByIdentifier('cervical', templates);
    expect(template?.id).toBe('cervical');
    expect(template?.code).toBe('CS1');
  });

  it('resolves a screening template by protocol code', () => {
    const template = findScreeningTemplateByIdentifier('bs1', templates);
    expect(template?.id).toBe('bowel');
    expect(template?.code).toBe('BS1');
  });
});
