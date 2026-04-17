import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';

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
  const forename = searchParams.get('forename') || searchParams.get('first_name') || '';
  const screenType = searchParams.get('screen') || searchParams.get('screening') || '';

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><Search size={20} /></div>
        <p className="patient-greeting-text">
          {forename ? `Hi ${forename},` : 'Hi,'} {org ? `${org} has` : 'your practice has'} sent
          you information about {screenType || 'a screening programme'}.
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

      {/* TODO: Build out screening-specific cards per type */}
      <div className="card" style={{ padding: '2rem', borderLeft: '4px solid #005eb8' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>
          {screenType
            ? `${screenType.charAt(0).toUpperCase() + screenType.slice(1)} Screening`
            : 'Screening Information'}
        </h2>
        <p style={{ color: '#4c6272' }}>
          Content for this screening type will be rendered here.
          Each screening programme (cervical, bowel, breast, AAA, diabetic eye)
          will have its own card with NHS guidance links and next steps.
        </p>
      </div>
    </div>
  );
};

export default ScreeningView;
