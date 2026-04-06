import React, { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { ExternalLink, Info, ShieldAlert, FlaskConical, X, Monitor, ChevronRight, AlertCircle } from 'lucide-react';
import { validateOrganisation } from './protocolService';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PracticeSignup from './pages/PracticeSignup';
import PracticeLogin from './pages/PracticeLogin';
import PracticeDashboard from './pages/PracticeDashboard';
import DrugBuilder from './pages/DrugBuilder';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import { useMedicationCatalog } from './medicationCatalog';
import { getMedicationIcon } from './medicationIcons';

const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;

const getValidationCacheKey = (orgName: string) =>
  `practice-validation:${orgName.trim().toLowerCase()}`;

const ResourceView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || searchParams.get('med') || '';
  const orgParam = searchParams.get('org');
  const codesParam = searchParams.get('codes');

  const [isAuthorised, setIsAuthorised] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { medicationMap: allMeds } = useMedicationCatalog();

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
      return codes
        .map(code => allMeds[code] ? { id: code, icon: getMedicationIcon(code), ...allMeds[code] } : null)
        .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title);
    }

    // Fallback: extract from code/med param (demo mode: ?code=101)
    const codes = rawCode.match(/\d0[12]/g) || [];
    const uniqueCodes = Array.from(new Set(codes));
    return uniqueCodes
      .map(code => allMeds[code] ? { id: code, icon: getMedicationIcon(code), ...allMeds[code] } : null)
      .filter((item): item is NonNullable<typeof item> => item !== null && !!item.title);
  }, [rawCode, orgParam, codesParam, isAuthorised, allMeds]);

  // Show loading while validating
  if (isValidating && orgParam) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
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
      <div className="card" style={{ textAlign: 'center', borderLeft: '4px solid #d5281b' }}>
        <AlertCircle size={64} color="#d5281b" style={{ marginBottom: '1rem' }} />
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
      <div className="card" style={{ textAlign: 'center' }}>
        <FlaskConical size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>MyMedInfo</h1>
        <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '1rem' }}>Clear, trusted medication information</p>
        <p>Please use the link provided by your GP or scan the QR code to find information about your specific medication.</p>
        {!orgParam && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            {Object.entries(allMeds).map(([key, item]) => (
              <a key={key} href={`?code=${key}`} className="resource-card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--nhs-blue)', marginBottom: '0.5rem' }}>{getMedicationIcon(key)}</div>
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
        <div className="patient-summary" style={{ marginBottom: '2rem', padding: '1.25rem', background: '#eef7ff', borderRadius: '12px', border: '1px solid #005eb8', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#005eb8', color: 'white', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
            <Info size={20} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, color: '#005eb8', fontSize: '1.1rem' }}>
            Consultation Summary: We found {contents.length} medication guides for you.
          </p>
        </div>
      )}

      <div className="patient-content-grid">
        {contents.map((content) => (
          <article key={content.id} className="patient-content-panel">
            <div className="card patient-card">
              <span className={`badge badge-${content.badge.toLowerCase()}`}>
                {content.badge === 'NEW' ? 'NEW MEDICATION' : content.badge === 'REAUTH' ? 'ANNUAL REVIEW' : 'MEDICATION INFORMATION'}
              </span>

              {content.badge === 'NEW' && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#eef7ff', borderRadius: '8px', borderLeft: '4px solid #005eb8' }}>
                  <div style={{ fontWeight: 700, color: '#005eb8', marginBottom: '0.25rem' }}>Beginning Your Treatment</div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#212b32' }}>
                    You are starting a new course of treatment. This information will help you understand your medication and how to take it safely.
                  </p>
                </div>
              )}

              {content.badge === 'REAUTH' && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f4f5', borderRadius: '8px', borderLeft: '4px solid #005eb8' }}>
                  <div style={{ fontWeight: 700, color: '#212b32', marginBottom: '0.25rem' }}>Annual Treatment Reminder</div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#4c6272' }}>
                    As you have been taking this medication for 12 months or more, we are sending this as a routine review reminder of safe management.
                  </p>
                </div>
              )}

              <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {content.title}
              </h1>
              <p>{content.description}</p>

              <div style={{ marginTop: '2rem' }}>
                <h2>Key Information</h2>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {content.keyInfo.map((info, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                      <div style={{ marginTop: '0.2rem' }}>
                        <Info size={22} color="#005eb8" style={{ flexShrink: 0 }} />
                      </div>
                      <span style={{ fontSize: '1.1rem' }}>{info}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {content.sickDaysNeeded && (
                <div className="sick-days-callout">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ background: '#005eb8', color: 'white', padding: '0.2rem 0.5rem', fontWeight: 800 }}>NHS</div>
                      <span style={{ fontWeight: 600 }}>Official Guidance</span>
                    </div>
                    <h3>Read NHS.UK</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>Read the comprehensive medical guide from the NHS website.</p>
                    <span className="patient-resource-arrow"><ExternalLink size={18} /></span>
                  </a>
                )}

                {content.trendLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="patient-resource-link">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <FlaskConical size={24} color="#007f3b" />
                      <span style={{ fontWeight: 600 }}>Trend Diabetes</span>
                    </div>
                    <h3>{link.title}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>Specific leaflet for living well with your medication.</p>
                    <span className="patient-resource-arrow"><ExternalLink size={18} /></span>
                  </a>
                ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

const ClinicianDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCode = searchParams.get('code');
  const { medicationMap } = useMedicationCatalog();

  const selectScenario = (code: string) => {
    setSearchParams({ code });
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

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header>
          <div className="header-content">
            <img src="/MyMedinfo.png" alt="MyMedInfo" style={{ height: 'auto', width: '80px', marginBottom: '0' }} />
          </div>
        </header>

        <main>
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
          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            This information is for guidance only. Always follow the specific advice from your GP or clinical team.
          </p>
        </footer>

        <ClinicianDemo />
      </div>
    </BrowserRouter>
  );
};

export default App;
