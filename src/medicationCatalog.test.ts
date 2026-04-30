/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDICATIONS } from './medicationData';

const seedSqlPath = resolve(process.cwd(), 'supabase/seed-medications.sql');
const seedSql = readFileSync(seedSqlPath, 'utf8');

describe('medication catalog consistency', () => {
  it('keeps built-in medication codes unique and paired by family', () => {
    const codes = MEDICATIONS.map((med) => med.code);
    expect(new Set(codes).size).toBe(codes.length);

    const families = new Map<string, string[]>();
    codes.forEach((code) => {
      const family = code.slice(0, 2);
      families.set(family, [...(families.get(family) || []), code]);
    });

    expect(Array.from(families.values()).every((familyCodes) => familyCodes.length === 2)).toBe(true);
    expect(Array.from(families.values()).every((familyCodes) => familyCodes.includes(`${familyCodes[0].slice(0, 2)}1`) && familyCodes.includes(`${familyCodes[0].slice(0, 2)}2`))).toBe(true);
  });

  it('keeps the Supabase seed aligned with built-in code, title, description, badge, and category values', () => {
    MEDICATIONS.forEach((med) => {
      expect(seedSql).toContain(`'${med.code}'`);
      expect(seedSql).toContain(`$$${med.title}$$`);
      expect(seedSql).toContain(`$$${med.description}$$`);
      expect(seedSql).toContain(`'${med.badge}'`);
      expect(seedSql).toContain(`$$${med.category}$$`);
    });
  });
});
