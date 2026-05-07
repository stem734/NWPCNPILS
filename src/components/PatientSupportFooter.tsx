import React from 'react';

type PatientSupportFooterProps = {
  text?: string;
  compact?: boolean;
};

const DEFAULT_TEXT = '';

const PatientSupportFooter: React.FC<PatientSupportFooterProps> = ({ text = DEFAULT_TEXT, compact = false }) => {
  return (
    <div className={`patient-support-footer${compact ? ' patient-support-footer--compact' : ''}`} role="note" aria-label="Practice contact reminder">
      <p className="patient-support-footer__text">{text}</p>
    </div>
  );
};

export default PatientSupportFooter;
