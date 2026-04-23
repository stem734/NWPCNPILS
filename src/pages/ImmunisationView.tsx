import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldPlus, ShieldCheck, ExternalLink, Phone, Mail, Globe } from 'lucide-react';
import { IMMUNISATION_TEMPLATES, type ImmunisationTemplate } from '../patientTemplateCatalog';
import { fetchCardTemplates } from '../cardTemplateStore';
import { fetchPatientPracticeCardTemplates } from '../practiceCardTemplateStore';
import { usePracticeContentAccess } from '../usePracticeContentAccess';

/**
 * ImmunisationView — renders post-immunisation information.
 *
 * Expected params:
 *   ?type=imms&org=PracticeName&vaccine=flu
 *   ?type=imms&org=PracticeName&vaccine=covid,shingles
 *
 * Supported vaccine types (extend as needed):
 *   flu | covid | shingles | pneumo | pertussis | mmr | hpv
 */
const ImmunisationView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const isDemoMode = searchParams.get('demo') === '1';
  const vaccines = (searchParams.get('vaccine') || searchParams.get('jab') || searchParams.get('imms') || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  const localSupportName = searchParams.get('localName') || `${org || 'Your practice'} support team`;
  const localPhone = searchParams.get('localPhone') || '';
  const localEmail = searchParams.get('localEmail') || '';
  const localWebsite = searchParams.get('localWebsite') || '';
  const requestedVaccines = useMemo(() => (vaccines.length > 0 ? vaccines : ['flu']), [vaccines]);
  const requestedVaccinesKey = requestedVaccines.join(',');
  const [loadedTemplateMap, setLoadedTemplateMap] = useState<Record<string, ImmunisationTemplate>>({});
  const access = usePracticeContentAccess(org, 'immunisation_enabled', { skip: isDemoMode });
  const selectedVaccines = requestedVaccines
    .map((vaccineCode) => loadedTemplateMap[vaccineCode] || IMMUNISATION_TEMPLATES[vaccineCode])
    .filter(Boolean);

  useEffect(() => {
    const loadTemplates = async () => {
      if (isDemoMode) {
        setLoadedTemplateMap({});
        return;
      }

      try {
        const practiceRows = await fetchPatientPracticeCardTemplates<ImmunisationTemplate>(org, 'immunisation', requestedVaccines);
        const practiceMap = Object.fromEntries(practiceRows.map((row) => [row.template_id, row.payload]));
        const rows = await fetchCardTemplates<ImmunisationTemplate>('immunisation', requestedVaccines);
        setLoadedTemplateMap({
          ...Object.fromEntries(rows.map((row) => [row.template_id, row.payload])),
          ...practiceMap,
        });
      } catch (error) {
        console.error('Failed to load immunisation template overrides', error);
        setLoadedTemplateMap({});
      }
    };
    void loadTemplates();
  }, [isDemoMode, org, requestedVaccines, requestedVaccinesKey]);

  if (access.loading) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <ShieldPlus size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Immunisation Information</h1>
        <p style={{ color: '#4c6272', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.6 }}>
          Checking whether this practice has immunisation information enabled.
        </p>
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <ShieldCheck size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Immunisation Information</h1>
        <p style={{ color: '#4c6272', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
          {access.error || 'This practice has not enabled immunisation information yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><ShieldPlus size={20} /></div>
        <p className="patient-greeting-text">
          Hi, {org ? `${org} has` : 'your practice has'} sent
          you information about your immunisation{selectedVaccines.length !== 1 ? 's' : ''}.
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

      {selectedVaccines.map((template) => (
        <div key={template.id} className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #005eb8', marginBottom: '1rem' }}>
          <h2 style={{ marginBottom: '0.4rem' }}>{template.label}</h2>
          <p style={{ color: '#1d2a33', marginBottom: '0.65rem' }}>{template.headline}</p>
          <p style={{ color: '#4c6272', marginBottom: '1rem' }}>{template.explanation}</p>

          <div className="patient-info-section">
            <h3 style={{ marginBottom: '0.5rem' }}>Aftercare and guidance</h3>
            <ul className="patient-info-list">
              {template.guidance.map((item, index) => (
                <li key={index} className="patient-info-item">
                  <div className="patient-info-icon"><ShieldCheck size={18} color="#007f3b" /></div>
                  <span className="patient-info-text">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="patient-resources">
            <h3 className="patient-resources-heading">NHS and local support links</h3>
            <div className="patient-resource-list">
              {template.nhsLinks.map((link) => (
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
      ))}
    </div>
  );
};

export default ImmunisationView;
