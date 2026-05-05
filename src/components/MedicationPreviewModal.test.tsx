import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MedicationPreviewModal from './MedicationPreviewModal';
import type { MedContent } from '../medicationData';

const medication: MedContent = {
  code: '201',
  title: 'SGLT2 inhibitor medicine - Starting Treatment',
  description: 'Patient-facing information.',
  badge: 'NEW',
  category: 'SGLT2 Inhibitors',
  keyInfoMode: 'do',
  keyInfo: ['Stay hydrated'],
  doKeyInfo: ['Stay hydrated'],
  dontKeyInfo: ['Do not restart while unwell'],
  generalKeyInfo: ['Review kidney function'],
  nhsLink: 'https://www.nhs.uk',
  trendLinks: [],
  sickDaysNeeded: true,
};

describe('MedicationPreviewModal', () => {
  it('stores preview data before mounting the patient iframe', () => {
    render(<MedicationPreviewModal med={medication} onClose={() => {}} />);

    const iframe = screen.getByTitle('Medication patient preview') as HTMLIFrameElement;
    const previewToken = new URL(iframe.src).searchParams.get('previewToken');

    expect(previewToken).toMatch(/^medication-preview:201:/);
    expect(previewToken).toBeTruthy();
    expect(window.sessionStorage.getItem(previewToken as string)).toContain(medication.title);
  });
});
