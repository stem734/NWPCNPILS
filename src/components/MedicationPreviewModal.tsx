import React from 'react';
import { CircleHelp, ExternalLink, Eye, FlaskConical } from 'lucide-react';
import type { MedContent } from '../medicationData';
import { getMedicationIcon } from '../medicationIcons';
import Modal from './Modal';
import { NhsCross, NhsTick } from './NhsIcons';
import WarningCallout from './WarningCallout';

type MedicationPreviewModalProps = {
  med: MedContent;
  onClose: () => void;
};

const MedicationPreviewModal: React.FC<MedicationPreviewModalProps> = ({ med, onClose }) => {
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
            <div className="medication-preview__callout-title">Beginning Your Treatment</div>
            <p className="medication-preview__callout-body">
              You are starting a new course of treatment. This information will help you understand your medication and how to take it safely.
            </p>
          </div>
        )}

        {med.badge === 'REAUTH' && (
          <div className="medication-preview__callout medication-preview__callout--grey">
            <div className="medication-preview__callout-title medication-preview__callout-title--dark">Annual Treatment Reminder</div>
            <p className="medication-preview__callout-body medication-preview__callout-body--muted">
              As you have been taking this medication for 12 months or more, we are sending this as a routine review reminder of safe management.
            </p>
          </div>
        )}

        <h2 className="medication-preview__title">
          <span className="medication-preview__title-icon" aria-hidden="true">{getMedicationIcon(med.code)}</span>
          {med.title}
        </h2>
        <p className="medication-preview__description">{med.description}</p>

        {med.generalKeyInfo?.length ? (
          <div className="medication-preview__section">
            <h3>General advice</h3>
            <ul className="medication-preview__key-list">
              {med.generalKeyInfo.map((info, index) => (
                <li key={`${med.code}-general-${index}`} className="medication-preview__key-item">
                  <CircleHelp size={20} color="var(--nhs-blue)" aria-hidden="true" />
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
