import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { detectContentType, CONTENT_TYPES } from '../contentRouter';

// All content views are lazy-loaded to keep patient routes split by content type.
const ResourceView = React.lazy(() => import('./ResourceView'));
const HealthCheckView = React.lazy(() => import('./HealthCheckView'));
const ScreeningView = React.lazy(() => import('./ScreeningView'));
const ImmunisationView = React.lazy(() => import('./ImmunisationView'));
const LongTermConditionView = React.lazy(() => import('./LongTermConditionView'));

/**
 * PatientRouter — detects the content type from URL params
 * and renders the appropriate view component.
 *
 * URL formats from SystmOne:
 *   ?type=meds&org=...&codes=101,201        → Medication info
 *   ?type=healthcheck&org=...&s1=CSV        → NHS Health Check
 *   ?type=screening&org=...&screen=cervical → Screening info
 *   ?type=imms&org=...&vaccine=flu          → Immunisation info
 *   ?org=...&codes=101,201                  → Auto-detect → meds
 */
const PatientRouter: React.FC = () => {
  const [searchParams] = useSearchParams();

  const { contentType } = useMemo(
    () => detectContentType(searchParams),
    [searchParams],
  );

  const renderContent = () => {
    switch (contentType) {
      case CONTENT_TYPES.HEALTH_CHECK:
        return <HealthCheckView />;
      case CONTENT_TYPES.SCREENING:
        return <ScreeningView />;
      case CONTENT_TYPES.IMMUNISATION:
        return <ImmunisationView />;
      case CONTENT_TYPES.LONG_TERM_CONDITION:
        return <LongTermConditionView />;
      case CONTENT_TYPES.MEDICATION:
      case CONTENT_TYPES.UNKNOWN:
      default:
        return <ResourceView />;
    }
  };

  return (
    <React.Suspense fallback={
      <div className="card patient-state-card" style={{ textAlign: 'center' }}>
        <p style={{ marginTop: '1rem', color: '#4c6272' }}>Loading...</p>
      </div>
    }>
      {renderContent()}
    </React.Suspense>
  );
};

export default PatientRouter;
