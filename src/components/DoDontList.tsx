import React from 'react';
import { Check, X } from 'lucide-react';

type DoDontListProps = {
  title: string;
  doItems?: string[];
  dontItems?: string[];
};

const DoDontList: React.FC<DoDontListProps> = ({ title, doItems = [], dontItems = [] }) => {
  const titleId = React.useId();

  return (
    <section className="do-dont-list" aria-labelledby={titleId}>
      <div className="do-dont-list__title">
        <h2 id={titleId}>{title}</h2>
      </div>

      {doItems.length > 0 && (
        <div className="do-dont-list__panel do-dont-list__panel--do" aria-label="Do list">
          <div className="do-dont-list__panel-title">Do</div>
          <ul className="do-dont-list__items">
            {doItems.map((item, index) => (
              <li key={index} className="do-dont-list__item">
                <Check size={34} className="do-dont-list__icon do-dont-list__icon--do" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dontItems.length > 0 && (
        <div className="do-dont-list__panel do-dont-list__panel--dont" aria-label="Don't list">
          <div className="do-dont-list__panel-title">Don't</div>
          <ul className="do-dont-list__items">
            {dontItems.map((item, index) => (
              <li key={index} className="do-dont-list__item">
                <X size={34} className="do-dont-list__icon do-dont-list__icon--dont" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default DoDontList;
