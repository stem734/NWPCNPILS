import React from 'react';

type PatientSupportFooterProps = {
  text?: string;
};

const DEFAULT_TEXT = 'If you have any questions, please contact your GP practice.';

const PatientSupportFooter: React.FC<PatientSupportFooterProps> = ({ text = DEFAULT_TEXT }) => {
  return (
    <div className="patient-support-footer" role="note" aria-label="Practice contact reminder">
      <p className="patient-support-footer__text">{text}</p>
    </div>
  );
};

export default PatientSupportFooter;
