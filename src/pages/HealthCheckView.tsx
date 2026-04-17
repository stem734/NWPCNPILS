import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * HealthCheckView — renders NHS Health Check results.
 *
 * Expects URL params from SystmOne in one of these formats:
 *   ?type=healthcheck&org=PracticeName&s1=orgName,bpsys,bpdias,...
 *   ?type=healthcheck&org=PracticeName&hc=bp:128/78:BPNORMAL,bmi:33.2:BMI2
 *   ?type=healthcheck&org=PracticeName&bp=128/78&bps=BPNORMAL&bmi=33.2&bmis=BMI2
 *
 * The 18-field CSV format from SystmOne is:
 *   orgName, bpsys, bpdias, bpnote, act, smk, bmi, bminote,
 *   alc, qrisk, qrisknote, hba1c, hba1cnote, hdl, ldl, totchol, cholrv, bpsysdt
 *
 * TODO: Port the metric definitions and card rendering from the
 *       original MyNHSHealthCheck project into this component.
 */
const HealthCheckView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const org = searchParams.get('org') || '';
  const forename = searchParams.get('forename') || searchParams.get('first_name') || '';

  // Detect which param format is in use
  const s1Payload = searchParams.get('s1') || searchParams.get('s1csv') || searchParams.get('payload') || '';
  const hcPayload = searchParams.get('hc') || '';
  const hasIndividualParams = searchParams.has('bp') || searchParams.has('bmi');

  const hasData = !!(s1Payload || hcPayload || hasIndividualParams);

  if (!hasData) {
    return (
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <Activity size={64} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1>NHS Health Check</h1>
        <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '1rem' }}>
          Clear, trusted results for patients
        </p>
        <p style={{ color: '#4c6272', maxWidth: '44rem', margin: '0 auto', lineHeight: 1.6 }}>
          Use a health-check link to view your results. This page is generated from data sent
          directly by your GP practice through SystmOne.
        </p>
      </div>
    );
  }

  return (
    <div className="animation-container patient-view">
      <div className="patient-greeting-card" role="status" style={{ marginBottom: '1rem' }}>
        <div className="patient-greeting-icon"><Activity size={20} /></div>
        <p className="patient-greeting-text">
          {forename ? `Hi ${forename},` : 'Hi,'} here are your NHS Health Check results
          {org ? ` from ${org}` : ''}.
        </p>
      </div>

      <div className="data-indicator no-print" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        color: '#005eb8', fontSize: '0.9rem', backgroundColor: '#eef7ff',
        padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #005eb8',
        lineHeight: '1.4', marginBottom: '1.5rem'
      }}>
        <ShieldCheck size={20} style={{ flexShrink: 0 }} />
        <span>This information has been sent directly from your GP practice. No data is stored on our servers.</span>
      </div>

      {/* TODO: Parse metrics from params and render result cards */}
      <div className="card" style={{ padding: '2rem', textAlign: 'center', borderLeft: '4px solid #005eb8' }}>
        <AlertCircle size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Health Check Data Received</h2>
        <p style={{ color: '#4c6272', marginBottom: '1rem' }}>
          {s1Payload
            ? `Received SystmOne CSV payload with ${s1Payload.split(',').length} fields.`
            : hcPayload
              ? `Received ${hcPayload.split(',').length} health metrics.`
              : 'Received individual metric parameters.'}
        </p>
        <p style={{ fontSize: '0.85rem', color: '#768692' }}>
          The health check result cards will be rendered here once the metric
          definitions are integrated from the NHS Health Check project.
        </p>
      </div>
    </div>
  );
};

export default HealthCheckView;
