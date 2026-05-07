import React from 'react';

type PatientGuidanceNoticeProps = {
  text: string;
};

const PatientGuidanceNotice: React.FC<PatientGuidanceNoticeProps> = ({ text }) => {
  return (
    <div className="data-indicator data-indicator--nhs no-print" role="note" aria-label="Guidance notice">
      <span>{text}</span>
    </div>
  );
};

export default PatientGuidanceNotice;
