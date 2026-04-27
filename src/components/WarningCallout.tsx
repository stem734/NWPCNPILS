import React from 'react';

type WarningCalloutProps = {
  title: string;
  children: React.ReactNode;
};

const WarningCallout: React.FC<WarningCalloutProps> = ({ title, children }) => {
  const titleId = React.useId();

  return (
    <div className="warning-callout" role="note" aria-labelledby={titleId}>
      <div className="warning-callout__title">
        <span id={titleId} className="warning-callout__title-text">{title}</span>
      </div>
      <div className="warning-callout__content">{children}</div>
    </div>
  );
};

export default WarningCallout;
