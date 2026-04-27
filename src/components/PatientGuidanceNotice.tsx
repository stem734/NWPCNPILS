import React from 'react';

type PatientGuidanceNoticeProps = {
  text: string;
};

const PatientGuidanceNotice: React.FC<PatientGuidanceNoticeProps> = ({ text }) => {
  return (
    <div className="data-indicator data-indicator--nhs no-print" role="note" aria-label="Guidance notice">
      <img className="data-indicator__logo" src="/nhs-wordmark-blue.jpg" alt="NHS" />
      <span>{text}</span>
    </div>
  );
};

export default PatientGuidanceNotice;
