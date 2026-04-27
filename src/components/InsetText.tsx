import React from 'react';

type InsetTextProps = {
  children: React.ReactNode;
};

const InsetText: React.FC<InsetTextProps> = ({ children }) => {
  const id = React.useId();

  return (
    <div className="inset-text" role="note" aria-labelledby={id}>
      <span className="inset-text__border" aria-hidden="true" />
      <div className="inset-text__content">
        <span id={id} className="sr-only">Information:</span>
        <div className="inset-text__body">{children}</div>
      </div>
    </div>
  );
};

export default InsetText;
