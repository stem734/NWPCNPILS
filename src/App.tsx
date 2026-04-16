import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ExternalLink, Info, ShieldAlert, FlaskConical, X, Monitor, ChevronRight, AlertCircle, Star, ShieldCheck, Printer } from 'lucide-react';
import { parseMedicationCodes, recordPatientAccess, resolveOrganisationMedicationCards, validateOrganisation } from './protocolService';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PracticeSignup from './pages/PracticeSignup';
import PracticeLogin from './pages/PracticeLogin';
import PracticeDashboard from './pages/PracticeDashboard';
import DrugBuilder from './pages/DrugBuilder';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import ResetPassword from './pages/ResetPassword';
import { useMedicationCatalog } from './medicationCatalog';
import { getMedicationIcon } from './medicationIcons';
import { supabase } from './supabase';
import { getSubdomain, adminUrl, practiceUrl } from './subdomainUtils';
const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
const MEDICATION_BADGE_ORDER: Record<'NEW' | 'REAUTH' | 'GENERAL', number> = {
  NEW: 0,
  REAUTH: 1,
  GENERAL: 2,
};

const getValidationCacheKey = (orgName: string) =>
  `practice-validation:${orgName.trim().toLowerCase()}`;

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

const ResourceView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || searchParams.get('med') || '';
  const orgParam = searchParams.get('org');
  const orgName = orgParam?.trim() || '';
  const forenameParam = searchParams.get('forename') || searchParams.get('first_name') || searchParams.get('firstname');
  const nhsNumberParam = searchParams.get('nhs_number') || searchParams.get('nhsNumber') || searchParams.get('nhs');
  const codesParam = searchParams.get('codes');
  const dateParam = searchParams.get('date');
  const unnamedValues = useMemo(() => {
    const values: string[] = [];

    searchParams.forEach((value, key) => {
      if (key === 'org' || key === 'code' || key === 'med' || key === 'codes' || key === 'forename' || key === 'first_name' || key === 'firstname' || key === 'nhs_number' || key === 'nhsNumber' || key === 'nhs' || key === 'date') {
        return;
      }

      if (value === '') {
        values.push(key);
      }
    });

    return values;
  }, [searchParams]);
  const fallbackForename = unnamedValues[0];
  const fallbackNhsNumber = unnamedValues[1];
  const forename = (forenameParam || fallbackForename || '').trim();
  const nhsNumber = (nhsNumberParam || fallbackNhsNumber || '').trim();

  const isOutOfDate = useMemo(() => {
    if (!dateParam) return false;
    
    // SystmOne often uses DD/MM/YYYY or YYYY-MM-DD
    // If it's DD/MM/YYYY, new Date() might fail on some browsers depending on locale
    let dateToParse = dateParam;
    if (dateParam.includes('/')) {
      const parts = dateParam.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY -> MM/DD/YYYY for Date constructor safety or use YYYY-MM-DD
        if (parts[2].length === 4) {
          dateToParse = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
    }

    const issuedDate = new Date(dateToParse);
    if (isNaN(issuedDate.getTime())) return false;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return issuedDate < sixMonthsAgo;
  }, [dateParam]);

  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
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
  const loggedAccessKeyRef = useRef<string | null>(null);

  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const handleRating = async (value: number) => {
    if (hasRated || !orgName) return;
    setRating(value);
    setIsSubmittingRating(true);
    try {
      await supabase.rpc('submit_patient_rating', { org_name: orgName, rating_value: value });
      setHasRated(true);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
    setIsSubmittingRating(false);
  };

  // Validate organisation against database
  useEffect(() => {
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
          const parsed = JSON.parse(cached) as { expiresAt?: number; valid?: boolean };
          if (isFreshValidationCache(parsed)) {
            if (!cancelled) {
              setIsAuthorised(true);
              setAuthError(null);
              setIsValidating(false);
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

      if (result.valid) {
        window.sessionStorage.setItem(cacheKey, JSON.stringify({
          valid: true,
          expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
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
  }, [orgName]);

  useEffect(() => {
    if (!orgName || isAuthorised !== true) {
      loggedAccessKeyRef.current = null;
      return;
    }

    const accessKey = `${orgName.toLowerCase()}|${codesParam || rawCode || ''}`;
    if (loggedAccessKeyRef.current === accessKey) {
      return;
    }

    loggedAccessKeyRef.current = accessKey;
    void recordPatientAccess(orgName);
  }, [codesParam, isAuthorised, orgName, rawCode]);

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
      if (!orgName || isAuthorised !== true || requestedCodes.length === 0) {
        if (!cancelled) {
          setResolvedContents([]);
          setIsResolvingContents(false);
        }
        return;
      }

      setIsResolvingContents(true);

      try {
        const cards = await resolveOrganisationMedicationCards(orgName, requestedCodes);
        if (!cancelled) {
          setResolvedContents(cards);
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
  }, [isAuthorised, orgName, requestedCodes]);

  const contents = useMemo(() => {
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
  }, [allMeds, isAuthorised, orgName, requestedCodes, resolvedContents]);

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

  const patientGreeting = `${forename ? `Hi ${forename},` : 'Hi,'} ${
    orgName ? `${orgName} has shared the information below about your medication.` : 'has shared the information below about your medication.'
  }${nhsNumber ? ` If you need it your NHS Number is ${nhsNumber}.` : ''}`;

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
        <button onClick={() => window.print()} className="action-button" style={{ backgroundColor: '#4c6272', color: 'white', padding: '0.5rem 1rem', fontSize: '0.9rem', marginTop: 0 }}>
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
        </div>
      )}
    </div>
  );
};

const ClinicianDemo: React.FC<{ show?: boolean }> = ({ show = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const currentCode = searchParams.get('code');
  const { medicationMap } = useMedicationCatalog();
  const navigate = useNavigate();

  if (!show) return null;

  const selectScenario = (code: string) => {
    navigate(`/patient?code=${encodeURIComponent(code)}`);
    setIsOpen(false);
  };

  return (
    <>
      <button className="demo-fab" onClick={() => setIsOpen(true)} title="Clinician Demo Mode">
        <Monitor size={28} />
      </button>

      {isOpen && (
        <div className="demo-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="demo-modal" onClick={e => e.stopPropagation()}>
            <div className="demo-header">
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Clinician Demo Scenarios</h2>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}
              >
                <X size={24} />
              </button>
            </div>
            <div className="demo-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                Select a scenario to demonstrate how the portal appears to patients based on different SystmOne protocols.
              </p>
              {Object.entries(medicationMap).map(([code, med]) => (
                <button
                  key={code}
                  className={`scenario-card ${currentCode === code ? 'active' : ''}`}
                  onClick={() => selectScenario(code)}
                >
                  <div className="scenario-icon">
                    {getMedicationIcon(code)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#212b32' }}>{med.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#4c6272' }}>SystmOne Code: {code}</div>
                  </div>
                  <ChevronRight size={18} color="#d8dde0" />
                </button>
              ))}
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff9c4', borderRadius: '8px', border: '1px solid #fbc02d' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Multi-Med Test</div>
                <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Test a clinical string with multiple medications and placeholders.</p>
                <button
                  className="action-button"
                  style={{ width: '100%', backgroundColor: '#fbc02d', color: '#212b32', justifyContent: 'center' }}
                  onClick={() => selectScenario('101????301??')}
                >
                  Load 101????301??
                </button>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafb', fontSize: '0.8rem', color: '#4c6272', borderTop: '1px solid #d8dde0' }}>
              <strong>Tip:</strong> In a live setting, SystmOne will automatically redirect the patient to these URLs.
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const SubdomainRoutes: React.FC = () => {
  const subdomain = getSubdomain();

  if (subdomain === 'admin') {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/drug-builder" element={<DrugBuilder />} />
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
      <Route path="/patient" element={<ResourceView />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/signup" element={<PracticeSignup />} />
      <Route path="/admin/drug-builder" element={<DrugBuilder />} />
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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
        <SubdomainRoutes />
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} <a href="https://www.nottinghamwestpcn.co.uk/" target="_blank" rel="noopener noreferrer">Nottingham West Primary Care Network</a> - MyMedInfo</p>
        <p>
          This information is for guidance only. Always follow the specific advice from your GP or clinical team.
        </p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
          <a href={adminUrl()} style={{ color: 'inherit', textDecoration: 'none' }}>Admin</a>
          {' · '}
          <a href={practiceUrl()} style={{ color: 'inherit', textDecoration: 'none' }}>Practice</a>
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
