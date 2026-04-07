import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { MEDICATIONS, type MedContent } from './medicationData';

export type MedicationRecord = MedContent & {
  source: 'built-in' | 'override' | 'custom';
  isBuiltIn: boolean;
};

type MedicationOverride = Partial<MedContent> & {
  code: string;
  is_deleted?: boolean;
};

const BUILT_IN_MAP = new Map(MEDICATIONS.map((med) => [med.code, med]));

const sortByCode = (left: { code: string }, right: { code: string }) =>
  Number.parseInt(left.code, 10) - Number.parseInt(right.code, 10);

export const mergeMedicationCatalog = (overrides: MedicationOverride[]): MedicationRecord[] => {
  const merged = new Map<string, MedicationRecord>(
    MEDICATIONS.map((med) => [
      med.code,
      {
        ...med,
        source: 'built-in' as const,
        isBuiltIn: true,
      },
    ]),
  );

  overrides.forEach((override) => {
    if (!override.code) {
      return;
    }

    if (override.is_deleted) {
      merged.delete(override.code);
      return;
    }

    const builtIn = BUILT_IN_MAP.get(override.code);
    const base = builtIn ?? null;

    if (!override.title || !override.description || !override.category || !override.badge) {
      return;
    }

    merged.set(override.code, {
      code: override.code,
      title: override.title,
      description: override.description,
      badge: override.badge,
      category: override.category,
      keyInfo: Array.isArray(override.keyInfo) ? override.keyInfo : base?.keyInfo ?? [],
      reviewMonths:
        typeof override.reviewMonths === 'number' && override.reviewMonths > 0
          ? override.reviewMonths
          : base?.reviewMonths ?? 12,
      contentReviewDate: typeof override.contentReviewDate === 'string' ? override.contentReviewDate : base?.contentReviewDate,
      nhsLink: typeof override.nhsLink === 'string' ? override.nhsLink : base?.nhsLink,
      trendLinks: Array.isArray(override.trendLinks) ? override.trendLinks : base?.trendLinks ?? [],
      sickDaysNeeded: typeof override.sickDaysNeeded === 'boolean' ? override.sickDaysNeeded : base?.sickDaysNeeded,
      source: builtIn ? 'override' : 'custom',
      isBuiltIn: Boolean(builtIn),
    });
  });

  return Array.from(merged.values()).sort(sortByCode);
};

export const buildMedicationMap = (medications: MedicationRecord[]): Record<string, MedicationRecord> =>
  Object.fromEntries(medications.map((med) => [med.code, med]));

export const loadMedicationCatalog = async (): Promise<MedicationRecord[]> => {
  const snapshot = await getDocs(collection(db, 'medications'));
  const overrides = snapshot.docs.map((doc) => doc.data() as MedicationOverride);
  return mergeMedicationCatalog(overrides);
};

export const useMedicationCatalog = () => {
  const [medications, setMedications] = useState<MedicationRecord[]>(() => mergeMedicationCatalog([]));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await loadMedicationCatalog();
      setMedications(catalog);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const medicationMap = useMemo(() => buildMedicationMap(medications), [medications]);

  return {
    medications,
    medicationMap,
    loading,
    reload,
  };
};
