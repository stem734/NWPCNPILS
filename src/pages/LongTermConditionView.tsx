import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { LONG_TERM_CONDITION_TEMPLATES } from '../patientTemplateCatalog';

const LongTermConditionView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const conditionType = (searchParams.get('ltc') || searchParams.get('condition') || '').trim().toLowerCase();
  const selectedTemplate = LONG_TERM_CONDITION_TEMPLATES[conditionType] || LONG_TERM_CONDITION_TEMPLATES.asthma;

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><ClipboardList size={20} /></div>
        <p className="patient-greeting-text">
          Hi, {org ? `${org} has` : 'your practice has'} sent you information about {selectedTemplate.label.toLowerCase()}.
        </p>
      </div>

      <div className="data-indicator no-print" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        color: '#005eb8', fontSize: '0.9rem', backgroundColor: '#eef7ff',
        padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #005eb8',
        lineHeight: '1.4', marginBottom: '1.5rem',
      }}>
        <ShieldCheck size={20} style={{ flexShrink: 0 }} />
        <span>This information has been sent directly from your GP practice.</span>
      </div>

      <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #005eb8', marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.4rem' }}>{selectedTemplate.label}</h2>
        <p style={{ color: '#1d2a33', marginBottom: '0.65rem' }}>{selectedTemplate.headline}</p>
        <p style={{ color: '#4c6272', marginBottom: '1rem' }}>{selectedTemplate.explanation}</p>

        {selectedTemplate.importantMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem',
            background: '#fde8e8',
            border: '1px solid #d5281b',
            borderRadius: '8px',
            color: '#7f0000',
            padding: '0.75rem 0.8rem',
            marginBottom: '0.9rem',
          }}>
            <AlertTriangle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>{selectedTemplate.importantMessage}</p>
          </div>
        )}

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
        </div>
      </div>
    </div>
  );
};

export default LongTermConditionView;
