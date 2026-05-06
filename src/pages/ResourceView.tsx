import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, FlaskConical, Info, Printer, Star } from 'lucide-react';
import { parseMedicationCodes, recordPatientAccess, resolveOrganisationMedicationCards, validateOrganisation } from '../protocolService';
import { DEFAULT_PRACTICE_FEATURE_SETTINGS, type PracticeFeatureSettings } from '../practiceFeatures';
import { useMedicationCatalog } from '../medicationCatalog';
import { supabase } from '../supabase';
import { getDemoNoticeText } from '../demoHelpers';
import { isIssuedDateStale } from '../dateHelpers';
import { useUrlExpiry } from '../useUrlExpiry';
import WarningCallout from '../components/WarningCallout';
import PatientGuidanceNotice from '../components/PatientGuidanceNotice';
import SickDayRulesModal from '../components/SickDayRulesModal';
import { NhsCross, NhsTick } from '../components/NhsIcons';
import { getPracticeLookupFromSearchParams } from '../practiceLookup';

const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
const VALIDATION_CACHE_VERSION = 'v2';
const MEDICATION_BADGE_ORDER: Record<'NEW' | 'REAUTH' | 'GENERAL', number> = {
  NEW: 0,
  REAUTH: 1,
  GENERAL: 2,
};

const getValidationCacheKey = (orgName: string) =>
  `practice-validation:${VALIDATION_CACHE_VERSION}:${orgName.trim().toLowerCase()}`;

const clearValidationCache = (orgName: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(getValidationCacheKey(orgName));
  } catch {
    // sessionStorage may be unavailable (private mode); safe to ignore.
  }
};

const isFreshValidationCache = (value: { expiresAt?: number; valid?: boolean }) =>
  value.valid === true &&
  typeof value.expiresAt === 'number' &&
  value.expiresAt > Date.now();

const GROUP_COPY: Record<'NEW' | 'REAUTH' | 'GENERAL', { title: string; description: string }> = {
  NEW: {
    title: 'New Medications',
    description: 'You have been newly prescribed these medicines. Please read this information carefully so you know what to expect and how to take them safely.',
  },
  REAUTH: {
    title: 'Annual Reviews',
    description: 'You are already prescribed these medicines. They are included here as a reminder and as part of your routine annual review.',
  },
  GENERAL: {
    title: 'Medication Information',
    description: 'These medicines include general information to help you manage your treatment safely.',
  },
};

const stripTreatmentSuffix = (title: string) =>
  title
    .replace(/\s*-\s*Starting Treatment$/i, '')
    .replace(/\s*-\s*Annual Review$/i, '');

const sortMedicationGroups = <
  T extends {
    id: string;
    badge: 'NEW' | 'REAUTH' | 'GENERAL';
  },
>(items: T[]) =>
  [...items].sort((left, right) => {
    const badgeDiff = MEDICATION_BADGE_ORDER[left.badge] - MEDICATION_BADGE_ORDER[right.badge];
    if (badgeDiff !== 0) {
      return badgeDiff;
    }

    return Number.parseInt(left.id, 10) - Number.parseInt(right.id, 10);
  });

type PatientMedicationContent = {
  state: 'global' | 'custom' | 'placeholder';
  code: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  title: string;
  description: string;
  category: string;
  keyInfoMode?: 'do' | 'dont';
  doKeyInfo?: string[];
  dontKeyInfo?: string[];
  generalKeyInfo?: string[];
  keyInfo: string[];
  nhsLink?: string;
  trendLinks: { title: string; url: string }[];
  sickDaysNeeded?: boolean;
  reviewMonths?: number;
  contentReviewDate?: string;
  linkExpiryValue?: number;
  linkExpiryUnit?: 'weeks' | 'months';
};

const ResourceView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || searchParams.get('med') || '';
  const practiceLookup = getPracticeLookupFromSearchParams(searchParams);
  const orgName = practiceLookup.orgName;
  const practiceIdentifier = practiceLookup.lookupValue;
  const hasPracticeIdentifier = practiceLookup.hasIdentifier;
  const codesParam = searchParams.get('codes');
  const dateParam = searchParams.get('date');
  const isDemoMode = searchParams.get('demo') === '1';
  const isExactDemo = searchParams.get('exactDemo') === '1';
  const previewOnly = searchParams.get('previewOnly') === '1';
  const previewToken = (searchParams.get('previewToken') || '').trim();

  const isOutOfDate = useMemo(() => isIssuedDateStale(dateParam, 6), [dateParam]);
  const [resolvedContents, setResolvedContents] = useState<PatientMedicationContent[]>([]);

  // Use the shortest expiry across all resolved cards so the check fires as
  // soon as any card on the page has expired.
  const shortestMedExpiry = useMemo(() => {
    return resolvedContents.reduce<{ value: number; unit: 'weeks' | 'months' } | undefined>(
      (shortest, card) => {
        if (!card.linkExpiryValue || !card.linkExpiryUnit) return shortest;
        const days = card.linkExpiryUnit === 'weeks' ? card.linkExpiryValue * 7 : card.linkExpiryValue * 30;
        if (!shortest) return { value: card.linkExpiryValue, unit: card.linkExpiryUnit };
        const sDays = shortest.unit === 'weeks' ? shortest.value * 7 : shortest.value * 30;
        return days < sDays ? { value: card.linkExpiryValue, unit: card.linkExpiryUnit } : shortest;
      },
      undefined,
    );
  }, [resolvedContents]);
  const isExpired = useUrlExpiry(shortestMedExpiry);

  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [practiceFeatures, setPracticeFeatures] = useState<PracticeFeatureSettings>(DEFAULT_PRACTICE_FEATURE_SETTINGS);
  const [validationNonce, setValidationNonce] = useState(0);
  const { medicationMap: allMeds } = useMedicationCatalog();
  const [isResolvingContents, setIsResolvingContents] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const loggedAccessKeyRef = useRef<string | null>(null);

  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [sickDayModalOpen, setSickDayModalOpen] = useState(false);

  const previewContents = useMemo<PatientMedicationContent[]>(() => {
    if (!previewOnly || !previewToken || typeof window === 'undefined') {
      return [] as PatientMedicationContent[];
    }

    try {
      const raw = window.sessionStorage.getItem(previewToken);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { cards?: Array<{
        state?: 'global' | 'custom' | 'placeholder';
        code?: string;
        badge?: 'NEW' | 'REAUTH' | 'GENERAL';
        title?: string;
        description?: string;
        category?: string;
        keyInfoMode?: 'do' | 'dont';
        doKeyInfo?: string[];
        dontKeyInfo?: string[];
        generalKeyInfo?: string[];
        keyInfo?: string[];
        nhsLink?: string;
        trendLinks?: { title: string; url: string }[];
        sickDaysNeeded?: boolean;
        reviewMonths?: number;
      }> };

      return (parsed.cards || []).filter((card) =>
        card &&
        typeof card.code === 'string' &&
        typeof card.title === 'string' &&
        typeof card.description === 'string' &&
        typeof card.category === 'string' &&
        (card.badge === 'NEW' || card.badge === 'REAUTH' || card.badge === 'GENERAL'),
      ).map((card) => ({
        state: card.state || 'custom',
        code: card.code as string,
        badge: card.badge as 'NEW' | 'REAUTH' | 'GENERAL',
        title: card.title as string,
        description: card.description as string,
        category: card.category as string,
        keyInfoMode: card.keyInfoMode === 'dont' ? 'dont' as const : 'do' as const,
        doKeyInfo: Array.isArray(card.doKeyInfo) ? card.doKeyInfo : [],
        dontKeyInfo: Array.isArray(card.dontKeyInfo) ? card.dontKeyInfo : [],
        generalKeyInfo: Array.isArray(card.generalKeyInfo) ? card.generalKeyInfo : [],
        keyInfo: Array.isArray(card.keyInfo) ? card.keyInfo : [],
        nhsLink: card.nhsLink,
        trendLinks: Array.isArray(card.trendLinks) ? card.trendLinks : [],
        sickDaysNeeded: Boolean(card.sickDaysNeeded),
        reviewMonths: typeof card.reviewMonths === 'number' ? card.reviewMonths : undefined,
      }));
    } catch {
      return [];
    }
  }, [previewOnly, previewToken]);

  const handleRating = async (value: number) => {
    if (hasRated || !practiceIdentifier) return;
    setRating(value);
    setRatingError(null);
    setIsSubmittingRating(true);
    try {
      const { data, error } = await supabase.rpc('submit_patient_rating', {
        org_name: practiceIdentifier,
        rating_value: value,
      });
      if (error) {
        throw error;
      }
      const result = data as { success?: boolean; error?: string; rate_limited?: boolean } | null;
      if (result && result.success === false) {
        setRatingError(result.error || 'Unable to submit rating. Please try again later.');
        setRating(0);
      } else {
        setHasRated(true);
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
      setRatingError('Unable to submit rating. Please try again later.');
      setRating(0);
    }
    setIsSubmittingRating(false);
  };

  useEffect(() => {
    if (previewOnly) {
      setIsAuthorised(true);
      setAuthError(null);
      setIsValidating(false);
      return;
    }

    if (isDemoMode) {
      setIsAuthorised(true);
      setAuthError(null);
      setIsValidating(false);
      return;
    }

    let cancelled = false;
    let loadingTimer: number | undefined;

    const validate = async () => {
      if (!hasPracticeIdentifier) {
        if (!cancelled) {
          setIsAuthorised(null);
          setAuthError(null);
          setIsValidating(false);
        }
        return;
      }

      const cacheKey = getValidationCacheKey(practiceLookup.cacheKey);
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { expiresAt?: number; valid?: boolean; practiceFeatures?: PracticeFeatureSettings };
          if (isFreshValidationCache(parsed)) {
            if (!cancelled) {
              setIsAuthorised(true);
              setAuthError(null);
              setIsValidating(false);
              setPracticeFeatures(parsed.practiceFeatures || DEFAULT_PRACTICE_FEATURE_SETTINGS);
            }
            return;
          }
        } catch {
          // Ignore invalid cached values and fall through to live validation.
        }
        window.sessionStorage.removeItem(cacheKey);
      }

      if (!cancelled) {
        setIsAuthorised(null);
        setAuthError(null);
        setPracticeFeatures(DEFAULT_PRACTICE_FEATURE_SETTINGS);
      }
      loadingTimer = window.setTimeout(() => {
        if (!cancelled) {
          setIsValidating(true);
        }
      }, 150);

      const result = await validateOrganisation(practiceIdentifier);
      if (cancelled) return;

      if (loadingTimer !== undefined) {
        window.clearTimeout(loadingTimer);
      }
      setIsAuthorised(result.valid);
      setAuthError(result.valid ? null : result.error || 'Practice not registered');
      setIsValidating(false);
      setPracticeFeatures(result.valid ? result.practiceFeatures : DEFAULT_PRACTICE_FEATURE_SETTINGS);

      if (result.valid) {
        window.sessionStorage.setItem(cacheKey, JSON.stringify({
          valid: true,
          expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
          practiceFeatures: result.practiceFeatures,
        }));
      } else {
        window.sessionStorage.removeItem(cacheKey);
      }
    };

    void validate();

    return () => {
      cancelled = true;
      if (loadingTimer !== undefined) {
        window.clearTimeout(loadingTimer);
      }
    };
  }, [hasPracticeIdentifier, isDemoMode, practiceIdentifier, practiceLookup.cacheKey, previewOnly, validationNonce]);

  useEffect(() => {
    if (isDemoMode || previewOnly) {
      loggedAccessKeyRef.current = null;
      return;
    }

    if (!practiceIdentifier || isAuthorised !== true) {
      loggedAccessKeyRef.current = null;
      return;
    }

    const accessKey = `${practiceIdentifier.toLowerCase()}|${codesParam || rawCode || ''}`;
    if (loggedAccessKeyRef.current === accessKey) {
      return;
    }

    loggedAccessKeyRef.current = accessKey;
    void (async () => {
      const result = await recordPatientAccess(practiceIdentifier);
      if (!result.ok) {
        clearValidationCache(practiceLookup.cacheKey);
        loggedAccessKeyRef.current = null;
        setIsAuthorised(null);
        setAuthError(null);
        setValidationNonce((n) => n + 1);
      }
    })();
  }, [codesParam, isAuthorised, isDemoMode, practiceIdentifier, practiceLookup.cacheKey, previewOnly, rawCode]);

  const requestedCodes = useMemo(() => {
    if (codesParam) {
      return Array.from(new Set(parseMedicationCodes(codesParam)));
    }

    const matches = rawCode.match(/\d{3}/g) || [];
    return Array.from(new Set(matches));
  }, [codesParam, rawCode]);

  useEffect(() => {
    let cancelled = false;

    const resolveCards = async () => {
      if (requestedCodes.length === 0) {
        if (previewOnly && previewContents.length > 0) {
          if (!cancelled) {
            setResolvedContents(previewContents);
            setResolveError(null);
            setIsResolvingContents(false);
          }
          return;
        }

        if (!cancelled) {
          setResolvedContents([]);
          setResolveError(null);
          setIsResolvingContents(false);
        }
        return;
      }

      if (previewOnly) {
        if (!cancelled) {
          setResolvedContents(previewContents);
          setResolveError(null);
          setIsResolvingContents(false);
        }
        return;
      }

      if (isDemoMode || !hasPracticeIdentifier) {
        if (!cancelled) {
          setResolvedContents(
            requestedCodes
              .map((code) => {
                const med = allMeds[code];
                return med ? { ...med, code, state: 'global' as const } : null;
              })
              .filter((item): item is NonNullable<typeof item> => item !== null),
          );
          setResolveError(null);
          setIsResolvingContents(false);
        }
        return;
      }

      if (isAuthorised !== true || !practiceFeatures.medication_enabled) {
        if (!cancelled) {
          setResolvedContents([]);
          setResolveError(null);
          setIsResolvingContents(false);
        }
        return;
      }

      setIsResolvingContents(true);

      try {
        const result = await resolveOrganisationMedicationCards(practiceIdentifier, requestedCodes);
        if (!cancelled) {
          if (result.ok) {
            setResolvedContents(result.cards);
            setResolveError(null);
          } else {
            setResolvedContents([]);
            setResolveError(result.error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsResolvingContents(false);
        }
      }
    };

    void resolveCards();

    return () => {
      cancelled = true;
    };
  }, [allMeds, hasPracticeIdentifier, isAuthorised, isDemoMode, practiceFeatures.medication_enabled, practiceIdentifier, previewContents, previewOnly, requestedCodes]);

  const contents = useMemo(() => {
    if (previewOnly) {
      return sortMedicationGroups(
        previewContents.map((card) => ({
          id: card.code,
          ...card,
        })),
      );
    }

    if (isDemoMode || !hasPracticeIdentifier) {
      return sortMedicationGroups(
        requestedCodes
          .map((code) => (allMeds[code] ? { id: code, state: 'global' as const, ...allMeds[code] } : null))
          .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title),
      );
    }

    if (hasPracticeIdentifier) {
      if (isAuthorised !== true) {
        return [];
      }

      return sortMedicationGroups(
        resolvedContents.map((card) => ({
          id: card.code,
          ...card,
        })),
      );
    }

    return sortMedicationGroups(
      requestedCodes
        .map((code) => (allMeds[code] ? { id: code, state: 'global' as const, ...allMeds[code] } : null))
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title),
    );
  }, [allMeds, hasPracticeIdentifier, isAuthorised, isDemoMode, previewContents, previewOnly, requestedCodes, resolvedContents]);

  const groupedContents = useMemo(() => {
    const groups = new Map<'NEW' | 'REAUTH' | 'GENERAL', typeof contents>();

    contents.forEach((content) => {
      const existing = groups.get(content.badge) ?? [];
      groups.set(content.badge, [...existing, content]);
    });

    return Array.from(groups.entries()).sort(
      ([leftBadge], [rightBadge]) => MEDICATION_BADGE_ORDER[leftBadge] - MEDICATION_BADGE_ORDER[rightBadge],
    );
  }, [contents]);

  const patientGreeting = orgName
    ? `Hi, ${orgName} has shared the information below about your medication.`
    : 'Hi, your practice has shared the information below about your medication.';

  const guidanceOrganisationName = useMemo(() => {
    if (resolvedContents.some((content) => content.state === 'custom') && orgName) {
      return orgName;
    }

    return 'Nottingham West Primary Care Network';
  }, [orgName, resolvedContents]);

  const guidanceNoticeText = `This information has been prepared and checked by the clinical pharmacists at ${guidanceOrganisationName}.`;

  if ((isValidating || isResolvingContents) && hasPracticeIdentifier && !previewOnly) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
            <FlaskConical size={64} color="#005eb8" />
          </div>
        </div>
        <h1>Loading...</h1>
      </div>
    );
  }

  if (hasPracticeIdentifier && isAuthorised === false && !previewOnly) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }} role="alert" aria-live="assertive">
        <AlertCircle size={64} color="#d5281b" style={{ marginBottom: '1rem' }} aria-hidden="true" />
        <h1>Practice Not Registered</h1>
        <p style={{ color: '#d5281b', marginBottom: '1rem' }}>{authError}</p>
        <p style={{ fontSize: '0.9rem', color: '#4c6272' }}>
          If your practice would like to use this service, please contact your PCN coordinator.
        </p>
      </div>
    );
  }

  if (hasPracticeIdentifier && isAuthorised === true && !practiceFeatures.medication_enabled && !previewOnly) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }} role="alert" aria-live="assertive">
        <AlertCircle size={64} color="#d5281b" style={{ marginBottom: '1rem' }} aria-hidden="true" />
        <h1>Medication Cards Unavailable</h1>
        <p style={{ color: '#d5281b', marginBottom: '1rem' }}>Medication cards are not enabled for this practice yet.</p>
        <p style={{ fontSize: '0.9rem', color: '#4c6272' }}>
          Please contact your GP practice if you were expecting medication information here.
        </p>
      </div>
    );
  }

  if (resolveError && hasPracticeIdentifier && requestedCodes.length > 0) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }} role="alert" aria-live="assertive">
        <AlertCircle size={64} color="#d5281b" style={{ marginBottom: '1rem' }} aria-hidden="true" />
        <h1>Medication Information Unavailable</h1>
        <p style={{ color: '#d5281b', marginBottom: '1rem' }}>{resolveError}</p>
        <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>
          This is usually a temporary issue. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#005eb8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <FlaskConical size={64} color="#adb5bd" style={{ marginBottom: '1rem' }} />
        <h1>Link Expired</h1>
        <p style={{ color: '#4c6272', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
          This link has expired. Please ask your GP practice to generate a new one.
        </p>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <FlaskConical size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>MyMedInfo</h1>
        <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '1rem' }}>Clear, trusted medication information</p>
        <p>Please use the link provided by your GP or scan the QR code to find information about your specific medication.</p>
        {!hasPracticeIdentifier && (
          <div className="patient-empty-grid">
            {Object.entries(allMeds).map(([key, item]) => (
              <a key={key} href={`?code=${key}`} className="resource-card patient-empty-card" style={{ textAlign: 'center' }}>
                <h3>{item.title}</h3>
                <span className={`badge badge-${item.badge.toLowerCase()}`}>{item.badge}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animation-container patient-view patient-page-shell">
      <SickDayRulesModal isOpen={sickDayModalOpen} onClose={() => setSickDayModalOpen(false)} />
      {isDemoMode && !isExactDemo && (
        <div className="patient-demo-banner no-print" role="note" aria-live="polite">
          {getDemoNoticeText()}
        </div>
      )}
      <div className="patient-greeting-card" role="status" aria-live="polite" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon">
          <Info size={20} aria-hidden="true" />
        </div>
        <p className="patient-greeting-text">{patientGreeting}</p>
      </div>

      {isOutOfDate && (
        <div className="out-of-date-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d5281b', fontSize: '0.95rem', backgroundColor: '#fde8e8', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #d5281b', marginBottom: '1rem', fontWeight: 600 }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>This information was issued over 6 months ago and may be out of date. Please contact your GP practice if you have any concerns.</span>
        </div>
      )}

      {!previewOnly && (
        <div className="patient-print-bar no-print">
          <button onClick={() => window.print()} className="action-button patient-print-button" style={{ backgroundColor: '#4c6272', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', marginTop: 0 }}>
            <Printer size={16} /> Print to PDF
          </button>
        </div>
      )}

      {groupedContents.map(([badge, items]) => (
        <section key={badge} className={`patient-section patient-section--${badge.toLowerCase()}`}>
          <div className={`patient-group-heading patient-group-heading--${badge.toLowerCase()}`}>
            <div className="patient-group-eyebrow">{GROUP_COPY[badge].title}</div>
            <p className="patient-group-copy">{GROUP_COPY[badge].description}</p>
          </div>

          <div className={`patient-content-grid${items.length === 1 ? ' patient-content-grid--single' : ''}`}>
            {items.map((content) => (
              <article key={content.id} className="patient-content-panel">
                <div className="card patient-card">
                  <div className="patient-card-meta">
                    <span className={`badge badge-${content.badge.toLowerCase()}`}>
                      {content.badge === 'NEW' ? 'START' : content.badge === 'REAUTH' ? 'REVIEW' : 'INFO'}
                    </span>
                  </div>

                  <h2 className="patient-medication-title">{stripTreatmentSuffix(content.title)}</h2>
                  <p className="patient-section-copy">{content.description}</p>

                  {content.state !== 'placeholder' && content.generalKeyInfo && content.generalKeyInfo.length > 0 && (
                    <div className="patient-info-section">
                      <h2 className="patient-section-title patient-section-title--small">General advice</h2>
                      <ul className="patient-info-list">
                        {content.generalKeyInfo.map((info, i) => (
                          <li key={`general-${i}`} className="patient-info-item">
                            <div className="patient-info-icon">
                              <span className="patient-info-bullet" aria-hidden="true">•</span>
                            </div>
                            <span className="patient-info-text">{info}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(content.state !== 'placeholder' && ((content.doKeyInfo && content.doKeyInfo.length > 0) || (content.keyInfoMode !== 'dont' && content.keyInfo.length > 0))) && (
                    <div className="patient-info-section">
                      <h2 className="patient-section-title patient-section-title--small">Do</h2>
                      <ul className="patient-info-list">
                        {(content.doKeyInfo?.length ? content.doKeyInfo : content.keyInfo).map((info, i) => (
                          <li key={`do-${i}`} className="patient-info-item">
                            <div className="patient-info-icon">
                              <NhsTick size={22} aria-hidden="true" />
                            </div>
                            <span className="patient-info-text">{info}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {content.state !== 'placeholder' && ((content.dontKeyInfo && content.dontKeyInfo.length > 0) || (content.keyInfoMode === 'dont' && content.keyInfo.length > 0)) && (
                    <div className="patient-info-section">
                      <h2 className="patient-section-title patient-section-title--small">Don't</h2>
                      <ul className="patient-info-list">
                        {(content.dontKeyInfo?.length ? content.dontKeyInfo : content.keyInfo).map((info, i) => (
                          <li key={`dont-${i}`} className="patient-info-item">
                            <div className="patient-info-icon">
                              <NhsCross size={22} aria-hidden="true" />
                            </div>
                            <span className="patient-info-text">{info}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {content.state !== 'placeholder' && content.sickDaysNeeded && (
                    <WarningCallout title="Important: Sick day rules apply">
                      <p style={{ marginBottom: '0.75rem', color: '#212b32' }}>
                        If you become unwell and are unable to eat or drink normally, you may need to pause this medication.
                      </p>
                      <button type="button" onClick={() => setSickDayModalOpen(true)} className="action-button">
                        View Sick Day Rules
                      </button>
                    </WarningCallout>
                  )}

                  {content.state !== 'placeholder' && (content.nhsLink || content.trendLinks.length > 0) && (
                    <div className="patient-resources patient-section-divider">
                      <h2 className="patient-resources-heading">
                        Trusted Resources for {content.title.split('-')[0].trim()}
                      </h2>
                      <div className="patient-resource-list patient-resource-list--compact">
                        {content.nhsLink && (
                          <a href={content.nhsLink} target="_blank" rel="noopener noreferrer" className="patient-resource-link patient-resource-link--compact">
                            <div className="patient-resource-meta">
                              <div className="patient-resource-chip">NHS</div>
                              <span className="patient-resource-meta-text">Official Guidance</span>
                            </div>
                            <h3>Read NHS.UK <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>(opens in new tab)</span></h3>
                            <p className="patient-resource-copy">Read the comprehensive medical guide from the NHS website.</p>
                            <span className="patient-resource-arrow"><ExternalLink size={18} /></span>
                          </a>
                        )}

                        {content.trendLinks.map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="patient-resource-link patient-resource-link--compact">
                            <div className="patient-resource-meta patient-resource-meta--trend">
                              <FlaskConical size={24} color="#007f3b" />
                              <span className="patient-resource-meta-text">Trend Diabetes</span>
                            </div>
                            <h3>{link.title} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>(opens in new tab)</span></h3>
                            <p className="patient-resource-copy">Specific leaflet for living well with your medication.</p>
                            <span className="patient-resource-arrow"><ExternalLink size={18} /></span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {hasPracticeIdentifier && isAuthorised && contents.length > 0 && (
        <div className="card hc-rating" style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem 1rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#212b32' }}>Did you find this information useful?</h2>
          {hasRated ? (
            <div style={{ color: '#007f3b', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '1rem' }}>Thank you for your feedback!</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  disabled={isSubmittingRating}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: isSubmittingRating ? 'default' : 'pointer',
                    padding: '0.5rem',
                    opacity: isSubmittingRating ? 0.5 : 1,
                    transition: 'transform 0.2s',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmittingRating) {
                      const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                      if (buttons) {
                        for (let i = 0; i < 5; i += 1) {
                          const svg = buttons[i].querySelector('svg');
                          if (svg) svg.style.fill = i <= star - 1 ? '#fbc02d' : 'none';
                          if (svg) svg.style.stroke = i <= star - 1 ? '#fbc02d' : '#8A99A8';
                        }
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmittingRating) {
                      const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                      if (buttons) {
                        for (let i = 0; i < 5; i += 1) {
                          const svg = buttons[i].querySelector('svg');
                          if (svg) svg.style.fill = i <= rating - 1 ? '#fbc02d' : 'none';
                          if (svg) svg.style.stroke = i <= rating - 1 ? '#fbc02d' : '#8A99A8';
                        }
                      }
                    }
                  }}
                >
                  <Star
                    size={36}
                    color={star <= rating ? '#fbc02d' : '#8A99A8'}
                    fill={star <= rating ? '#fbc02d' : 'none'}
                  />
                </button>
              ))}
            </div>
          )}
          {ratingError && !hasRated && (
            <p
              role="alert"
              style={{ marginTop: '1rem', color: '#d5281b', fontSize: '0.95rem' }}
            >
              {ratingError}
            </p>
          )}
        </div>
      )}

      {hasPracticeIdentifier && isAuthorised && contents.length > 0 && (
        <div className="hc-rating__notice">
          <PatientGuidanceNotice text={guidanceNoticeText} />
        </div>
      )}

    </div>
  );
};

export default ResourceView;
