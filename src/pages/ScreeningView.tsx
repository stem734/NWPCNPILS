import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, ExternalLink } from 'lucide-react';
import {
  SCREENING_TEMPLATES,
  findScreeningTemplateByIdentifier,
  hydrateScreeningTemplate,
  type ScreeningTemplate,
  withScreeningTemplateDefaults,
} from '../patientTemplateCatalog';
import { fetchCardTemplates } from '../cardTemplateStore';
import { fetchPatientPracticeCardTemplates } from '../practiceCardTemplateStore';
import { usePracticeContentAccess } from '../usePracticeContentAccess';
import { NhsCross, NhsTick } from '../components/NhsIcons';

/**
 * ScreeningView — renders screening invitation / result info.
 *
 * Expected params:
 *   ?type=screening&org=PracticeName&screen=cervical
 *   ?type=screening&org=PracticeName&screen=bowel
 *
 * Supported screening types (extend as needed):
 *   cervical | bowel | breast | aaa | diabetic_eye
 */
const ScreeningView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const isDemoMode = searchParams.get('demo') === '1';
  const previewOnly = searchParams.get('previewOnly') === '1';
  const previewToken = (searchParams.get('previewToken') || '').trim();
  const screenIdentifier = (searchParams.get('screen') || searchParams.get('screening') || '').trim();
  const [loadedTemplate, setLoadedTemplate] = useState<ScreeningTemplate | null>(null);
  const access = usePracticeContentAccess(org, 'screening_enabled', { skip: isDemoMode || previewOnly });
  const knownTemplateIds = useMemo(() => Object.keys(SCREENING_TEMPLATES), []);
  const selectedTemplate = loadedTemplate;

  useEffect(() => {
    const loadTemplate = async () => {
      if (isDemoMode) {
        // Demo mode still uses the saved global template when one exists.
      }

      if (previewOnly && previewToken && typeof window !== 'undefined') {
        try {
          const raw = window.sessionStorage.getItem(previewToken);
          if (raw) {
            setLoadedTemplate(withScreeningTemplateDefaults(JSON.parse(raw) as ScreeningTemplate));
            return;
          }
        } catch {
          // ignore malformed preview payloads and fall back to stored templates
        }
      }

      try {
        const practiceRows = org
          ? await fetchPatientPracticeCardTemplates<ScreeningTemplate>(
            org,
            'screening',
            knownTemplateIds,
          )
          : [];
        const globalRows = await fetchCardTemplates<ScreeningTemplate>('screening');
        const candidateTemplates = [
          ...practiceRows.map((row) => hydrateScreeningTemplate(row.payload)),
          ...globalRows.map((row) => hydrateScreeningTemplate(row.payload)),
        ];
        setLoadedTemplate(findScreeningTemplateByIdentifier(screenIdentifier, candidateTemplates));
      } catch (error) {
        console.error('Failed to load screening template override', error);
        setLoadedTemplate(null);
      }
    };
    void loadTemplate();
  }, [isDemoMode, knownTemplateIds, org, previewOnly, previewToken, screenIdentifier]);

  if (access.loading) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <Search size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Screening Information</h1>
        <p style={{ color: '#4c6272', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.6 }}>
          Checking whether this practice has screening information enabled.
        </p>
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <ShieldCheck size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Screening Information</h1>
        <p style={{ color: '#4c6272', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
          {access.error || 'This practice has not enabled screening information yet.'}
        </p>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <Search size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>Screening Information</h1>
        <p style={{ color: '#4c6272', maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
          We could not find a screening card for this link. Please contact your GP practice if this problem continues.
        </p>
      </div>
    );
  }

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><Search size={20} /></div>
        <p className="patient-greeting-text">
          Hi, {org ? `${org} has` : 'your practice has'} sent
          you information about {selectedTemplate.label.toLowerCase()}.
        </p>
      </div>

      <div className="card patient-section-card">
        <h2 className="patient-section-title">{selectedTemplate.label}</h2>
        <p className="patient-section-copy">{selectedTemplate.headline}</p>

        <div className="patient-info-section">
          <h3 className="patient-section-title patient-section-title--small">Guidance</h3>
          <p className="patient-section-copy" style={{ marginBottom: 0 }}>{selectedTemplate.explanation}</p>
        </div>

        <div className="patient-info-section">
          <h3 className="patient-section-title patient-section-title--small">Do</h3>
          <ul className="patient-info-list">
            {selectedTemplate.guidance.map((item, index) => (
              <li key={index} className="patient-info-item">
                <div className="patient-info-icon"><NhsTick size={22} aria-hidden="true" /></div>
                <span className="patient-info-text">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {selectedTemplate.dontGuidance && selectedTemplate.dontGuidance.length > 0 && (
          <div className="patient-info-section">
            <h3 className="patient-section-title patient-section-title--small">Don&apos;t</h3>
            <ul className="patient-info-list">
              {selectedTemplate.dontGuidance.map((item, index) => (
                <li key={index} className="patient-info-item">
                  <div className="patient-info-icon"><NhsCross size={22} aria-hidden="true" /></div>
                  <span className="patient-info-text">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="patient-resources patient-section-divider" style={{ marginTop: 0 }}>
        <h2 className="patient-resources-heading">Trusted resources</h2>
        <div className="patient-resource-list patient-resource-list--compact">
          {selectedTemplate.nhsLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="patient-resource-link patient-resource-link--compact">
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

export default ScreeningView;
