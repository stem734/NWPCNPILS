import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, ExternalLink, Phone, Mail, Globe } from 'lucide-react';
import { SCREENING_TEMPLATES } from '../patientTemplateCatalog';

/**
 * ScreeningView — renders screening invitation / result info.
 *
 * Expected params:
 *   ?type=screening&org=PracticeName&screen=cervical
 *   ?type=screening&org=PracticeName&screen=bowel&forename=Jane
 *
 * Supported screening types (extend as needed):
 *   cervical | bowel | breast | aaa | diabetic_eye
 */
const ScreeningView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const screenType = (searchParams.get('screen') || searchParams.get('screening') || '').trim().toLowerCase();
  const localSupportName = searchParams.get('localName') || `${org || 'Your practice'} support team`;
  const localPhone = searchParams.get('localPhone') || '';
  const localEmail = searchParams.get('localEmail') || '';
  const localWebsite = searchParams.get('localWebsite') || '';
  const selectedTemplate = SCREENING_TEMPLATES[screenType] || SCREENING_TEMPLATES.cervical;

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><Search size={20} /></div>
        <p className="patient-greeting-text">
          Hi, {org ? `${org} has` : 'your practice has'} sent
          you information about {selectedTemplate.label.toLowerCase()}.
        </p>
      </div>

      <div className="data-indicator no-print" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        color: '#005eb8', fontSize: '0.9rem', backgroundColor: '#eef7ff',
        padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #005eb8',
        lineHeight: '1.4', marginBottom: '1.5rem'
      }}>
        <ShieldCheck size={20} style={{ flexShrink: 0 }} />
        <span>This information has been sent directly from your GP practice.</span>
      </div>

      <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #005eb8', marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.4rem' }}>{selectedTemplate.label}</h2>
        <p style={{ color: '#1d2a33', marginBottom: '0.65rem' }}>{selectedTemplate.headline}</p>
        <p style={{ color: '#4c6272', marginBottom: '1rem' }}>{selectedTemplate.explanation}</p>

        <div className="patient-info-section">
          <h3 style={{ marginBottom: '0.5rem' }}>What to do next</h3>
          <ul className="patient-info-list">
            {selectedTemplate.guidance.map((item, index) => (
              <li key={index} className="patient-info-item">
                <div className="patient-info-icon"><ShieldCheck size={18} color="#007f3b" /></div>
                <span className="patient-info-text">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="patient-resources" style={{ marginTop: 0 }}>
        <h2 className="patient-resources-heading">Trusted resources</h2>
        <div className="patient-resource-list">
          {selectedTemplate.nhsLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="patient-resource-link">
              <div className="patient-resource-meta">
                <div className="patient-resource-chip">NHS</div>
                <span className="patient-resource-meta-text">National guidance</span>
              </div>
              <h3>{link.title}</h3>
              <p className="patient-resource-copy">{link.description}</p>
              <span className="patient-resource-arrow"><ExternalLink size={18} /></span>
            </a>
          ))}
          {(localPhone || localEmail || localWebsite) && (
            <div className="patient-resource-link" style={{ cursor: 'default' }}>
              <div className="patient-resource-meta">
                <div className="patient-resource-chip" style={{ background: '#007f3b' }}>LOCAL</div>
                <span className="patient-resource-meta-text">{localSupportName}</span>
              </div>
              {localPhone && (
                <p className="patient-resource-copy" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Phone size={15} /> {localPhone}
                </p>
              )}
              {localEmail && (
                <p className="patient-resource-copy" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={15} /> {localEmail}
                </p>
              )}
              {localWebsite && (
                <p className="patient-resource-copy" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Globe size={15} /> {localWebsite}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScreeningView;
