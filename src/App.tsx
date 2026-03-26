import React, { useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { ExternalLink, Info, ShieldAlert, FlaskConical, X, Monitor, ChevronRight, Droplets, Pill, Thermometer } from 'lucide-react';

// Content Mapping
interface MedResource {
  title: string;
  description: string;
  badge: 'NEW' | 'REAUTH' | 'GENERAL';
  icon: React.ReactNode;
  nhsLink?: string;
  trendLinks: { title: string; url: string }[];
  keyInfo: string[];
  sickDaysNeeded?: boolean;
}

const MED_MAPPING: Record<string, MedResource> = {
  '101': {
    title: 'Sulfonylurea - Starting Treatment',
    description: 'You are starting a Sulfonylurea medication (such as Gliclazide). This medicine helps your body produce more insulin to lower blood glucose.',
    badge: 'NEW',
    icon: <Pill size={20} />,
    nhsLink: 'https://www.nhs.uk/medicines/gliclazide/',
    trendLinks: [
      { title: 'Hypoglycaemia Explained', url: 'https://trenddiabetes.online/portfolio/diabetes-why-do-i-sometimes-feel-shaky-dizzy-and-sweaty-hypoglygaemia-explained/' }
    ],
    keyInfo: [
      'Take this medication with a meal.',
      'Be aware of "hypos" (low blood sugar).',
      'Always carry glucose or a sugary snack.'
    ]
  },
  '102': {
    title: 'Sulfonylurea - Reauthorisation',
    description: 'Your Sulfonylurea medication has been reviewed and reauthorised for another year. It continues to be an important part of your glucose management.',
    badge: 'REAUTH',
    icon: <Monitor size={20} />,
    nhsLink: 'https://www.nhs.uk/medicines/gliclazide/',
    trendLinks: [
      { title: 'Keeping well with T2 Diabetes', url: 'https://trenddiabetes.online/portfolio/65-years-old-keeping-well-with-your-type-2-diabetes/' }
    ],
    keyInfo: [
      'Continue taking as prescribed, usually with breakfast.',
      'Maintain regular check-ups.'
    ]
  },
  '201': {
    title: 'SGLT2 Inhibitor - First Initiation',
    description: 'You are starting an SGLT2 inhibitor (such as Dapagliflozin or Empagliflozin). This medicine helps your kidneys remove excess sugar through your urine.',
    badge: 'NEW',
    icon: <Droplets size={20} />,
    nhsLink: 'https://www.nhs.uk/conditions/type-2-diabetes/medicine/',
    trendLinks: [
      { title: 'A simple guide to SGLT2 inhibitors', url: 'https://trenddiabetes.online/portfolio/looking-after-your-heart-kidneys-and-glucose-levels-a-simple-guide-to-sglt2-inhibitors/' },
      { title: 'Genital Fungal Infection Prevention', url: 'https://trenddiabetes.online/portfolio/something-you-need-to-know-how-to-reduce-you-risk-of-genital-fungal-infection/' }
    ],
    keyInfo: [
      'Stay hydrated by drinking plenty of water.',
      'Maintain good personal hygiene to reduce infection risk.',
      'Be aware of the risk of Ketoacidosis (rare but serious).'
    ],
    sickDaysNeeded: true
  },
  '202': {
    title: 'SGLT2 Inhibitor - Reauthorisation',
    description: 'Your SGLT2 inhibitor treatment has been reviewed and reauthorised. This medication provides protection for your heart and kidneys.',
    badge: 'REAUTH',
    icon: <Droplets size={20} />,
    nhsLink: 'https://www.nhs.uk/conditions/type-2-diabetes/medicine/',
    trendLinks: [
      { title: 'A simple guide to SGLT2 inhibitors', url: 'https://trenddiabetes.online/portfolio/looking-after-your-heart-kidneys-and-glucose-levels-a-simple-guide-to-sglt2-inhibitors/' },
      { title: 'Sick Day Rules', url: 'https://trenddiabetes.online/portfolio/type-2-diabetes-what-to-do-when-you-are-ill/' }
    ],
    keyInfo: [
      'Continue to stay hydrated.',
      'Remember "Sick Day Rules" (Pause medication if you are unable to eat or drink).'
    ],
    sickDaysNeeded: true
  },
  '301': {
    title: 'Emollients and Skin Care',
    description: 'Emollients are moisturising treatments applied directly to the skin to soothe it and hydrate it.',
    badge: 'GENERAL',
    icon: <Droplets size={20} />,
    nhsLink: 'https://www.nhs.uk/conditions/emollients/',
    trendLinks: [],
    keyInfo: [
      'Apply frequently and in the direction of hair growth.',
      'Important: Emollients with paraffin or oils are flammable. Keep away from naked flames.',
      'Wash your hands after application if smoking.'
    ]
  },
  '401': {
    title: 'Insulin Therapy',
    description: 'Insulin is a vital hormone for managing your blood glucose levels. You have been prescribed or reviewed for insulin therapy.',
    badge: 'NEW',
    icon: <Thermometer size={20} />,
    nhsLink: 'https://www.nhs.uk/conditions/type-1-diabetes/insulin/',
    trendLinks: [
      { title: 'Keeping safe with insulin therapy', url: 'https://trenddiabetes.online/portfolio/keeping-safe-with-insulin-therapy/' },
      { title: 'Using an insulin cartridge pen', url: 'https://trenddiabetes.online/portfolio/a-stepwise-guide-on-how-to-use-an-insulin-cartridge-pen/' }
    ],
    keyInfo: [
      'Rotate your injection sites regularly.',
      'Check your injection sites for lumps (Lipohypertrophy).',
      'Inform the DVLA if you are a driver on insulin.'
    ],
    sickDaysNeeded: true
  },
  '501': {
    title: 'Mounjaro (Tirzepatide)',
    description: 'Mounjaro is a medication for Type 2 Diabetes that mimics hormones to improve blood sugar control and support weight management.',
    badge: 'NEW',
    icon: <FlaskConical size={20} />,
    nhsLink: 'https://www.nhs.uk/medicines/tirzepatide-mounjaro/',
    trendLinks: [
      { title: 'GLP-1 RA and GIP guide', url: 'https://trenddiabetes.online/portfolio/glp-1-ra-gip-glp-1-ra-and-type-2-diabetes/' }
    ],
    keyInfo: [
      'Usually a once-weekly injection.',
      'May cause nausea or gastrointestinal side effects initially.',
      'Report any severe abdominal pain immediately.'
    ]
  }
};

const ResourceView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawCode = searchParams.get('code') || searchParams.get('med') || '';

  const contents = useMemo(() => {
    // Extract all valid 3-digit clinical codes (e.g. 101, 102, 201, 202, 301, 401, 501)
    // This allows strings like "101????301??" to match both 101 and 301
    const codes = rawCode.match(/[1-5]0[12]/g) || [];
    const uniqueCodes = Array.from(new Set(codes));

    return uniqueCodes
      .map(code => ({ id: code, ...(MED_MAPPING[code] as MedResource) }))
      .filter(item => item && item.title);
  }, [rawCode]);

  if (contents.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <FlaskConical size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Patient Medication Portal</h1>
        <p>Please use the link provided by your GP or scan the QR code to find information about your specific medication.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          {Object.entries(MED_MAPPING).map(([key, item]) => (
            <a key={key} href={`?code=${key}`} className="resource-card" style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--nhs-blue)', marginBottom: '0.5rem' }}>{item.icon}</div>
              <h3>{item.title}</h3>
              <span className={`badge badge-${item.badge.toLowerCase()}`}>{item.badge}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animation-container">
      {contents.length > 1 && (
        <div style={{ marginBottom: '2rem', padding: '1.25rem', background: '#eef7ff', borderRadius: '12px', border: '1px solid #005eb8', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#005eb8', color: 'white', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
            <Info size={20} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, color: '#005eb8', fontSize: '1.1rem' }}>
            Consultation Summary: We found {contents.length} medication guides for you.
          </p>
        </div>
      )}

      {contents.map((content, idx) => (
        <div key={content.id} style={{ marginBottom: idx === contents.length - 1 ? 0 : '4rem' }}>
          <div className="card">
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
                <a href="https://trenddiabetes.online/portfolio/type-2-diabetes-what-to-do-when-you-are-ill/" target="_blank" rel="noopener noreferrer" className="action-button">
                  View Sick Day Guide <ExternalLink size={18} />
                </a>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--nhs-blue)', display: 'inline-block', paddingBottom: '0.25rem' }}>
              Trusted Resources for {content.title.split('-')[0]}
            </h2>
            <div className="resource-grid">
              {content.nhsLink && (
                <a href={content.nhsLink} target="_blank" rel="noopener noreferrer" className="resource-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ background: '#005eb8', color: 'white', padding: '0.2rem 0.5rem', fontWeight: 800 }}>NHS</div>
                    <span style={{ fontWeight: 600 }}>Official Guidance</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', flex: 1 }}>Read the comprehensive medical guide from the NHS website.</p>
                  <span className="action-button">Read NHS.UK <ExternalLink size={18} /></span>
                </a>
              )}

              {content.trendLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="resource-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <FlaskConical size={24} color="#007f3b" />
                    <span style={{ fontWeight: 600 }}>Trend Diabetes</span>
                  </div>
                  <h3>{link.title}</h3>
                  <p style={{ fontSize: '0.9rem', flex: 1 }}>Specific leaflet for living well with your medication.</p>
                  <span className="action-button" style={{ backgroundColor: '#007f3b' }}>View Resource <ExternalLink size={18} /></span>
                </a>
              ))}
            </div>
          </div>
          {idx < contents.length - 1 && <hr style={{ border: 'none', height: '1px', background: 'var(--nhs-border)', marginTop: '4rem', marginBottom: '4rem' }} />}
        </div>
      ))}
    </div>
  );
};

const ClinicianDemo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCode = searchParams.get('code');

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
              {Object.entries(MED_MAPPING).map(([code, med]) => (
                <button
                  key={code}
                  className={`scenario-card ${currentCode === code ? 'active' : ''}`}
                  onClick={() => selectScenario(code)}
                >
                  <div className="scenario-icon">
                    {med.icon}
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
            <span className="nhs-logo">NHS</span>
            <span style={{ fontWeight: 500, fontSize: '1.2rem', opacity: 0.9 }}>Medication Portal</span>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<ResourceView />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} North West PCN - Provided in partnership with SystmOne</p>
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
