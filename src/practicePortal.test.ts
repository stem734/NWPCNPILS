import { describe, expect, it } from 'vitest';
import { coerceResolvedMedicationCard } from './practicePortal';

describe('coerceResolvedMedicationCard', () => {
  it('preserves structured camelCase medication fields from patient RPC responses', () => {
    const card = coerceResolvedMedicationCard({
      state: 'global',
      code: '201',
      title: 'SGLT2 inhibitor',
      description: 'Description',
      badge: 'NEW',
      category: 'Diabetes',
      keyInfoMode: 'dont',
      keyInfo: ['Legacy warning'],
      doKeyInfo: ['Drink water'],
      dontKeyInfo: ['Do not restart while unwell'],
      generalKeyInfo: ['Review kidney function'],
      contentReviewDate: '2026-04-01',
    });

    expect(card.keyInfoMode).toBe('dont');
    expect(card.doKeyInfo).toEqual(['Drink water']);
    expect(card.dontKeyInfo).toEqual(['Do not restart while unwell']);
    expect(card.generalKeyInfo).toEqual(['Review kidney function']);
    expect(card.contentReviewDate).toBe('2026-04-01');
  });

  it('accepts snake_case fields from database-shaped responses', () => {
    const card = coerceResolvedMedicationCard({
      state: 'custom',
      code: '301',
      title: 'Emollient',
      description: 'Description',
      badge: 'GENERAL',
      category: 'Dermatology',
      key_info_mode: 'dont',
      key_info: ['Keep away from flames'],
      do_key_info: ['Apply regularly'],
      dont_key_info: ['Do not smoke after applying'],
      general_key_info: ['Store safely'],
      nhs_link: 'https://www.nhs.uk',
      trend_links: [{ title: 'Guide', url: 'https://example.com' }],
      sick_days_needed: true,
      review_months: 6,
      content_review_date: '2026-03-01',
    });

    expect(card.keyInfoMode).toBe('dont');
    expect(card.keyInfo).toEqual(['Keep away from flames']);
    expect(card.doKeyInfo).toEqual(['Apply regularly']);
    expect(card.dontKeyInfo).toEqual(['Do not smoke after applying']);
    expect(card.generalKeyInfo).toEqual(['Store safely']);
    expect(card.nhsLink).toBe('https://www.nhs.uk');
    expect(card.trendLinks).toEqual([{ title: 'Guide', url: 'https://example.com' }]);
    expect(card.sickDaysNeeded).toBe(true);
    expect(card.reviewMonths).toBe(6);
    expect(card.contentReviewDate).toBe('2026-03-01');
  });
});
