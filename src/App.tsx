import React, { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ExternalLink, Info, ShieldAlert, FlaskConical, X, Monitor, ChevronRight, AlertCircle, Star } from 'lucide-react';
import { validateOrganisation } from './protocolService';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PracticeSignup from './pages/PracticeSignup';
import PracticeLogin from './pages/PracticeLogin';
import PracticeDashboard from './pages/PracticeDashboard';
import DrugBuilder from './pages/DrugBuilder';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import HeaderNav from './components/HeaderNav';
import { useMedicationCatalog } from './medicationCatalog';
import { getMedicationIcon } from './medicationIcons';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
const MEDICATION_BADGE_ORDER: Record<'NEW' | 'REAUTH' | 'GENERAL', number> = {
  NEW: 0,
  REAUTH: 1,
  GENERAL: 2,
};

const getValidationCacheKey = (orgName: string) =>
  `practice-validation:${orgName.trim().toLowerCase()}`;

const GROUP_COPY: Record<'NEW' | 'REAUTH' | 'GENERAL', { title: string; description: string }> = {
  NEW: {
    title: 'New Medications',
    description: 'These medicines are newly starting and should be read first.',
  },
  REAUTH: {
    title: 'Annual Reviews',
    description: 'These medicines are already established and are shown as routine yearly reauthorisations.',
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
  const codesParam = searchParams.get('codes');

  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { medicationMap: allMeds } = useMedicationCatalog();

  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const handleRating = async (value: number) => {
    if (hasRated || !orgParam) return;
    setRating(value);
    setIsSubmittingRating(true);
    try {
      const submitRating = httpsCallable(functions, 'submitPatientRating');
      await submitRating({ orgName: orgParam, rating: value });
      setHasRated(true);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
    setIsSubmittingRating(false);
  };

  // Validate organisation against Firestore
  useEffect(() => {
    if (!orgParam) {
      setIsAuthorised(null);
      setAuthError(null);
      setIsValidating(false);
      return;
    }

    const cacheKey = getValidationCacheKey(orgParam);
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { expiresAt?: number; valid?: boolean };
        if (parsed.valid && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
          setIsAuthorised(true);
          setAuthError(null);
          setIsValidating(false);
          return;
        }
      } catch {
        // Ignore invalid cached values and fall through to live validation.
      }
      window.sessionStorage.removeItem(cacheKey);
    }

    setIsAuthorised(null);
    setAuthError(null);
    const loadingTimer = window.setTimeout(() => setIsValidating(true), 150);
    let cancelled = false;

    const validate = async () => {
      const result = await validateOrganisation(orgParam);
      if (cancelled) return;

      window.clearTimeout(loadingTimer);
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

    validate();

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [orgParam]);

  const contents = useMemo(() => {
    // If org param present, must be validated first
    if (orgParam && !isAuthorised) return [];

    // Use codes param if present (from SystmOne: ?org=NAME&codes=101,102,601)
    if (codesParam) {
      const codes = codesParam.split(',').map(c => c.trim()).filter(Boolean);
      const items = codes
        .map(code => allMeds[code] ? { id: code, icon: getMedicationIcon(code), ...allMeds[code] } : null)
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title);
      return sortMedicationGroups(items);
    }

    // Fallback: extract from code/med param (demo mode: ?code=101)
    const codes = rawCode.match(/\d0[12]/g) || [];
    const uniqueCodes = Array.from(new Set(codes));
    const items = uniqueCodes
      .map(code => allMeds[code] ? { id: code, icon: getMedicationIcon(code), ...allMeds[code] } : null)
      .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title);
    return sortMedicationGroups(items);
  }, [rawCode, orgParam, codesParam, isAuthorised, allMeds]);

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

  // Show loading while validating
  if (isValidating && orgParam) {
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
  if (orgParam && isAuthorised === false) {
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
        {!orgParam && (
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
      {contents.length > 1 && (
        <div className="patient-summary patient-summary-card" role="alert" aria-live="polite">
          <div className="patient-summary-icon">
            <Info size={20} aria-hidden="true" />
          </div>
          <p className="patient-summary-text">
            Your GP has shared {contents.length} medication guide{contents.length !== 1 ? 's' : ''} with you.
          </p>
        </div>
      )}

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

                  {content.sickDaysNeeded && (
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
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {orgParam && isAuthorised && contents.length > 0 && (
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

const AppContent: React.FC = () => {
  const location = useLocation();
  const showClinicianDemo = location.pathname === '/patient' || location.pathname === '/demo';

  return (
    <div className="app-container">
      <a href="#main-content" className="sr-only">Skip to content</a>
      <header>
        <div className="header-content">
          <img src="/MyMedinfo.png" alt="MyMedInfo" style={{ height: 'auto', width: '80px', marginBottom: '0' }} />
          <HeaderNav />
        </div>
      </header>

      <main id="main-content">
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
        </Routes>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Nottingham West Primary Care Network - MyMedInfo</p>
        <p>
          This information is for guidance only. Always follow the specific advice from your GP or clinical team.
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
