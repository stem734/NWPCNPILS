import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldPlus, ShieldCheck } from 'lucide-react';

/**
 * ImmunisationView — renders post-immunisation information.
 *
 * Expected params:
 *   ?type=imms&org=PracticeName&vaccine=flu&forename=Steve
 *   ?type=imms&org=PracticeName&vaccine=covid,shingles
 *
 * Supported vaccine types (extend as needed):
 *   flu | covid | shingles | pneumo | pertussis | mmr | hpv
 */
const ImmunisationView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const forename = searchParams.get('forename') || searchParams.get('first_name') || '';
  const vaccines = (searchParams.get('vaccine') || searchParams.get('jab') || searchParams.get('imms') || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><ShieldPlus size={20} /></div>
        <p className="patient-greeting-text">
          {forename ? `Hi ${forename},` : 'Hi,'} {org ? `${org} has` : 'your practice has'} sent
          you information about your {vaccines.length > 0 ? vaccines.join(' and ') : ''} immunisation{vaccines.length !== 1 ? 's' : ''}.
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

      {/* TODO: Build vaccine-specific info cards */}
      <div className="card" style={{ padding: '2rem', borderLeft: '4px solid #005eb8' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Immunisation Information</h2>
        <p style={{ color: '#4c6272' }}>
          {vaccines.length > 0
            ? `Information about: ${vaccines.join(', ')}.`
            : 'Vaccine information will be displayed here.'}
          {' '}Each vaccine type will have its own card with side effect guidance,
          NHS links, and what to expect after vaccination.
        </p>
      </div>
    </div>
  );
};

export default ImmunisationView;
