import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { ExternalLink, Info, ShieldAlert, FlaskConical, AlertCircle, Star, ShieldCheck, Printer } from 'lucide-react';
import { parseMedicationCodes, recordPatientAccess, resolveOrganisationMedicationCards, validateOrganisation } from './protocolService';
import { DEFAULT_PRACTICE_FEATURE_SETTINGS, type PracticeFeatureSettings } from './practiceFeatures';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PracticeSignup from './pages/PracticeSignup';
import PracticeLogin from './pages/PracticeLogin';
import PracticeDashboard from './pages/PracticeDashboard';
import CardBuilder from './pages/CardBuilder';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import ResetPassword from './pages/ResetPassword';
import PatientRouter from './pages/PatientRouter';
import LegalPage from './pages/LegalPage';
import { useMedicationCatalog } from './medicationCatalog';
import { getMedicationIcon } from './medicationIcons';
import { supabase } from './supabase';
import { getSubdomain } from './subdomainUtils';
import { getDemoNoticeText } from './demoHelpers';
import { isIssuedDateStale } from './dateHelpers';

declare const __APP_COMMIT_COUNT__: string;
declare const __APP_COMMIT_HASH__: string;

const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
// Bump when the cache shape or feature-flag schema changes so
// returning patients don't get stuck on stale data after a deploy.
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

export const ResourceView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || searchParams.get('med') || '';
  const orgParam = searchParams.get('org');
  const orgName = orgParam?.trim() || '';
  const codesParam = searchParams.get('codes');
  const dateParam = searchParams.get('date');
  const isDemoMode = searchParams.get('demo') === '1';


  const isOutOfDate = useMemo(() => isIssuedDateStale(dateParam, 6), [dateParam]);

  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [practiceFeatures, setPracticeFeatures] = useState<PracticeFeatureSettings>(DEFAULT_PRACTICE_FEATURE_SETTINGS);
  // Bumped when we detect the cached validation may be stale (e.g. the
  // practice was deactivated) to force the validation effect to re-run.
  const [validationNonce, setValidationNonce] = useState(0);
  const { medicationMap: allMeds } = useMedicationCatalog();
  const [resolvedContents, setResolvedContents] = useState<Array<{
    state: 'global' | 'custom' | 'placeholder';
    code: string;
    badge: 'NEW' | 'REAUTH' | 'GENERAL';
    title: string;
    description: string;
    category: string;
    keyInfo: string[];
    nhsLink?: string;
    trendLinks: { title: string; url: string }[];
    sickDaysNeeded?: boolean;
    reviewMonths?: number;
  }>>([]);
  const [isResolvingContents, setIsResolvingContents] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const loggedAccessKeyRef = useRef<string | null>(null);

  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const [ratingError, setRatingError] = useState<string | null>(null);

  const handleRating = async (value: number) => {
    if (hasRated || !orgName) return;
    setRating(value);
    setRatingError(null);
    setIsSubmittingRating(true);
    try {
      const { data, error } = await supabase.rpc('submit_patient_rating', {
        org_name: orgName,
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

  // Validate organisation against database
  useEffect(() => {
    if (isDemoMode) {
      setIsAuthorised(true);
      setAuthError(null);
      setIsValidating(false);
      return;
    }

    let cancelled = false;
    let loadingTimer: number | undefined;

    const validate = async () => {
      if (!orgName) {
        if (!cancelled) {
          setIsAuthorised(null);
          setAuthError(null);
          setIsValidating(false);
        }
        return;
      }

      const cacheKey = getValidationCacheKey(orgName);
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

      const result = await validateOrganisation(orgName);
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
  }, [isDemoMode, orgName, validationNonce]);

  useEffect(() => {
    if (isDemoMode) {
      loggedAccessKeyRef.current = null;
      return;
    }

    if (!orgName || isAuthorised !== true) {
      loggedAccessKeyRef.current = null;
      return;
    }

    const accessKey = `${orgName.toLowerCase()}|${codesParam || rawCode || ''}`;
    if (loggedAccessKeyRef.current === accessKey) {
      return;
    }

    loggedAccessKeyRef.current = accessKey;
    void (async () => {
      const result = await recordPatientAccess(orgName);
      if (!result.ok) {
        // Practice may have been deactivated while the cached validation
        // was still fresh; drop the cache and force a re-validation so
        // the patient doesn't keep seeing stale content for up to 5min.
        clearValidationCache(orgName);
        loggedAccessKeyRef.current = null;
        setIsAuthorised(null);
        setAuthError(null);
        setValidationNonce((n) => n + 1);
      }
    })();
  }, [codesParam, isAuthorised, isDemoMode, orgName, rawCode]);

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
        if (!cancelled) {
          setResolvedContents([]);
          setResolveError(null);
          setIsResolvingContents(false);
        }
        return;
      }

      if (isDemoMode || !orgName) {
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
        const result = await resolveOrganisationMedicationCards(orgName, requestedCodes);
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
  }, [allMeds, isAuthorised, isDemoMode, orgName, practiceFeatures.medication_enabled, requestedCodes]);

  const contents = useMemo(() => {
    if (isDemoMode || !orgName) {
      return sortMedicationGroups(
        requestedCodes
          .map((code) => (allMeds[code] ? { id: code, icon: getMedicationIcon(code), state: 'global' as const, ...allMeds[code] } : null))
          .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title),
      );
    }

    if (orgName) {
      if (isAuthorised !== true) {
        return [];
      }

      return sortMedicationGroups(
        resolvedContents.map((card) => ({
          id: card.code,
          icon: getMedicationIcon(card.code),
          ...card,
        })),
      );
    }

    return sortMedicationGroups(
      requestedCodes
        .map((code) => (allMeds[code] ? { id: code, icon: getMedicationIcon(code), state: 'global' as const, ...allMeds[code] } : null))
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title),
    );
  }, [allMeds, isAuthorised, isDemoMode, orgName, requestedCodes, resolvedContents]);

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

  // Show loading while validating
  if ((isValidating || isResolvingContents) && orgName) {
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

  // Show auth error - practice not signed up
  if (orgName && isAuthorised === false) {
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

  if (orgName && isAuthorised === true && !practiceFeatures.medication_enabled) {
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

  if (resolveError && orgName && requestedCodes.length > 0) {
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

  if (contents.length === 0) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <FlaskConical size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>MyMedInfo</h1>
        <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '1rem' }}>Clear, trusted medication information</p>
        <p>Please use the link provided by your GP or scan the QR code to find information about your specific medication.</p>
        {!orgName && (
          <div className="patient-empty-grid">
            {Object.entries(allMeds).map(([key, item]) => (
              <a key={key} href={`?code=${key}`} className="resource-card patient-empty-card" style={{ textAlign: 'center' }}>
                <div className="patient-empty-icon">{getMedicationIcon(key)}</div>
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
    <div className="animation-container patient-view">
      {isDemoMode && (
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

      <div className="patient-controls no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="data-indicator" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#005eb8', fontSize: '0.9rem', backgroundColor: '#eef7ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #005eb8', lineHeight: '1.4' }}>
          <ShieldCheck size={20} style={{ flexShrink: 0 }} />
          <span>This information has been sent to you directly from your GP practice. All information is stored on this device only. If you clear your browser this information will be removed.</span>
        </div>
      </div>

      <div className="patient-print-bar no-print">
        <button onClick={() => window.print()} className="action-button patient-print-button" style={{ backgroundColor: '#4c6272', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', marginTop: 0 }}>
          <Printer size={16} /> Print to PDF
        </button>
      </div>

      {groupedContents.map(([badge, items]) => (
        <section key={badge} className="patient-section">
          <div className="patient-group-heading">
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

                  <h1 className="patient-medication-title">
                    {content.title}
                  </h1>
                  <p>{content.description}</p>

                  {content.state !== 'placeholder' && content.keyInfo.length > 0 && (
                    <div className="patient-info-section">
                      <h2>Key Information</h2>
                      <ul className="patient-info-list">
                        {content.keyInfo.map((info, i) => (
                          <li key={i} className="patient-info-item">
                            <div className="patient-info-icon">
                              <Info size={22} color="#005eb8" style={{ flexShrink: 0 }} aria-hidden="true" />
                            </div>
                            <span className="patient-info-text">{info}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {content.state !== 'placeholder' && content.sickDaysNeeded && (
                    <div className="sick-days-callout">
                      <div className="sick-days-header">
                        <ShieldAlert size={28} color="#d5281b" />
                        <h2 style={{ margin: 0, color: '#212b32' }}>Sick Day Rules Apply</h2>
                      </div>
                      <p style={{ marginBottom: '1rem', color: '#212b32' }}>
                        If you become unwell and are unable to eat or drink normally, you may need to pause this medication.
                        Click the resources below to learn about "Sick Day Rules".
                      </p>
                      <a href="https://trenddiabetes.online/wp-content/uploads/2025/08/A5_T2Illness_TREND.pdf" target="_blank" rel="noopener noreferrer" className="action-button">
                        View Sick Day Guide <ExternalLink size={18} />
                      </a>
                    </div>
                  )}

                  {content.state !== 'placeholder' && (content.nhsLink || content.trendLinks.length > 0) && (
                    <div className="patient-resources">
                      <h2 className="patient-resources-heading">
                        Trusted Resources for {content.title.split('-')[0].trim()}
                      </h2>
                      <div className="patient-resource-list">
                      {content.nhsLink && (
                        <a href={content.nhsLink} target="_blank" rel="noopener noreferrer" className="patient-resource-link">
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
                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="patient-resource-link">
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

      {orgName && isAuthorised && contents.length > 0 && (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem 1rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#212b32' }}>Did you find this information useful?</h2>
          {hasRated ? (
            <div style={{ color: '#007f3b', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '1rem' }}>Thank you for your feedback!</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(star => (
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
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmittingRating) {
                      const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
                      if (buttons) {
                        for (let i = 0; i < 5; i++) {
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
                        for (let i = 0; i < 5; i++) {
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
    </div>
  );
};

const ClinicianDemo: React.FC<{ show?: boolean }> = ({ show = true }) => {
  if (!show) return null;

  return null;
};

const SubdomainRoutes: React.FC = () => {
  const subdomain = getSubdomain();

  if (subdomain === 'admin') {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/drug-builder" element={<CardBuilder />} />
        <Route path="/card-builder" element={<CardBuilder />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  if (subdomain === 'practice') {
    return (
      <Routes>
        <Route path="/" element={<PracticeLogin />} />
        <Route path="/dashboard" element={<PracticeDashboard />} />
        <Route path="/signup" element={<PracticeSignup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  // Default: main domain (www.mymedinfo.info / localhost)
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/patient" element={<PatientRouter />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/signup" element={<PracticeSignup />} />
      <Route path="/admin/drug-builder" element={<CardBuilder />} />
      <Route path="/admin/card-builder" element={<CardBuilder />} />
      <Route path="/practice" element={<PracticeLogin />} />
      <Route path="/practice/dashboard" element={<PracticeDashboard />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showClinicianDemo = location.pathname === '/patient' || location.pathname === '/demo';
  const showPatientGuidance = location.pathname === '/patient';
  const versionLabel = `0.0.1+${__APP_COMMIT_COUNT__}`;

  // Detect implicit-flow Supabase auth recovery tokens in the URL hash
  // and redirect to /reset-password. The PKCE ?code= flow is NOT handled
  // here — the reset email links directly to /reset-password?code=... so
  // no redirect is needed, and intercepting it here would cause a re-render
  // that re-initialises the Supabase client and consumes the one-time code.
  useEffect(() => {
    if (location.pathname === '/reset-password') return;

    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      if (hashParams.get('type') === 'recovery' || hashParams.get('error_code') === 'otp_expired') {
        navigate('/reset-password' + window.location.hash, { replace: true });
      }
    }
  }, [location, navigate]);

  // Listen for PASSWORD_RECOVERY event and redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY' && location.pathname !== '/reset-password') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [location, navigate]);

  return (
    <div className="app-container">
      <a href="#main-content" className="sr-only">Skip to content</a>
      <main id="main-content">
        {showPatientGuidance && (
          <div className="main-guidance-banner" role="note" aria-label="Guidance">
            <p>This information is for guidance only. Always follow the specific advice from your GP or clinical team.</p>
          </div>
        )}
        <SubdomainRoutes />
      </main>

      <footer className="footer">
        <p className="footer-copyright">
          © {new Date().getFullYear()} <a href="https://www.nottinghamwestpcn.co.uk/" target="_blank" rel="noopener noreferrer">Nottingham West Primary Care Network</a> - MyMedInfo
        </p>
        <p className="footer-version" title={`Commit ${__APP_COMMIT_HASH__}`}>
          <span className="footer-beta">Beta</span>
          <span>Version {versionLabel}</span>
        </p>
      </footer>

      <ClinicianDemo show={showClinicianDemo} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
