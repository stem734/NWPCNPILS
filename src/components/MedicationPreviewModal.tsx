import React from 'react';
import { ExternalLink, Eye, FlaskConical } from 'lucide-react';
import type { MedContent } from '../medicationData';
import Modal from './Modal';
import { NhsCross, NhsTick } from './NhsIcons';
import WarningCallout from './WarningCallout';

type MedicationPreviewModalProps = {
  med: MedContent;
  onClose: () => void;
};

const MedicationPreviewModal: React.FC<MedicationPreviewModalProps> = ({ med, onClose }) => {
  const displayTitle = med.title
    .replace(/\s*-\s*Starting Treatment$/i, '')
    .replace(/\s*-\s*Annual Review$/i, '');
  const calloutTitle = med.badge === 'NEW' ? `Start ${displayTitle}` : med.badge === 'REAUTH' ? `Review ${displayTitle}` : 'Medication information';

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title="Patient Preview"
      icon={<Eye size={20} color="var(--nhs-blue)" aria-hidden="true" />}
      bodyClassName="medication-preview__body"
      footer={<div className="medication-preview__footer-copy">This is a preview of what patients will see when they access this medication block.</div>}
    >
      <div className="medication-preview">
        <span
          className="medication-preview__badge"
          data-badge={med.badge}
        >
          {med.badge === 'NEW' ? 'NEW MEDICATION' : med.badge === 'REAUTH' ? 'ANNUAL REVIEW' : 'MEDICATION INFORMATION'}
        </span>

        {med.badge === 'NEW' && (
          <div className="medication-preview__callout medication-preview__callout--blue">
            <div className="medication-preview__callout-title">{calloutTitle}</div>
            <p className="medication-preview__callout-body">
              This page explains how to use this medicine safely and what to watch for.
            </p>
          </div>
        )}

        {med.badge === 'REAUTH' && (
          <div className="medication-preview__callout medication-preview__callout--grey">
            <div className="medication-preview__callout-title medication-preview__callout-title--dark">{calloutTitle}</div>
            <p className="medication-preview__callout-body medication-preview__callout-body--muted">
              This page summarises safe ongoing use and key reminders for this medicine.
            </p>
          </div>
        )}

        <h2 className="medication-preview__title">{displayTitle}</h2>
        <p className="medication-preview__description">{med.description}</p>

        {med.generalKeyInfo?.length ? (
          <div className="medication-preview__section">
            <h3>General advice</h3>
            <ul className="medication-preview__key-list">
              {med.generalKeyInfo.map((info, index) => (
                <li key={`${med.code}-general-${index}`} className="medication-preview__key-item">
                  <span className="medication-preview__bullet" aria-hidden="true">•</span>
                  <span>{info}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(med.doKeyInfo?.length || med.keyInfo.length > 0) && (
          <div className="medication-preview__section">
            <h3>Do</h3>
            <ul className="medication-preview__key-list">
              {(med.doKeyInfo?.length ? med.doKeyInfo : med.keyInfo).map((info, index) => (
                <li key={`${med.code}-do-${index}`} className="medication-preview__key-item">
                  <NhsTick size={20} aria-hidden="true" />
                  <span>{info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {med.dontKeyInfo?.length ? (
          <div className="medication-preview__section">
            <h3>Don't</h3>
            <ul className="medication-preview__key-list">
              {med.dontKeyInfo.map((info, index) => (
                <li key={`${med.code}-dont-${index}`} className="medication-preview__key-item">
                  <NhsCross size={20} aria-hidden="true" />
                  <span>{info}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {med.sickDaysNeeded && (
          <WarningCallout title="Important: Sick day rules apply">
            <p>If you become unwell and are unable to eat or drink normally, you may need to pause this medication.</p>
          </WarningCallout>
        )}

        <div className="medication-preview__section">
          <h3>Linked Resources</h3>
          <div className="medication-preview__links">
            {med.nhsLink && (
              <a href={med.nhsLink} target="_blank" rel="noopener noreferrer" className="medication-preview__link medication-preview__link--nhs">
                <div className="medication-preview__link-pill">NHS</div>
                <span>Official NHS Guidance</span>
                <ExternalLink size={16} color="var(--nhs-blue)" />
              </a>
            )}
            {med.trendLinks.map((link, index) => (
              <a key={`${med.code}-link-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="medication-preview__link medication-preview__link--trend">
                <FlaskConical size={16} color="var(--nhs-green)" />
                <span>{link.title}</span>
                <ExternalLink size={16} color="var(--nhs-green)" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MedicationPreviewModal;
