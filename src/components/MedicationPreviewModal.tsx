import React from 'react';
import { Eye } from 'lucide-react';
import type { MedContent } from '../medicationData';
import { resolvePath } from '../subdomainUtils';
import Modal from './Modal';

type MedicationPreviewModalProps = {
  med: MedContent;
  onClose: () => void;
};

const MedicationPreviewModal: React.FC<MedicationPreviewModalProps> = ({ med, onClose }) => {
  const previewUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      type: 'meds',
      previewOnly: '1',
      previewToken: `medication-preview:${med.code}:${Date.now()}`,
      codes: med.code,
    });

    try {
      window.sessionStorage.setItem(params.get('previewToken') || '', JSON.stringify({
        cards: [
          {
            ...med,
            state: 'custom',
            code: med.code,
          },
        ],
      }));
    } catch {
      // sessionStorage may be unavailable; this preview route depends on it.
    }

    return `${window.location.origin}${resolvePath('/patient')}?${params.toString()}`;
  }, [med]);

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
        <iframe
          key={previewUrl}
          title="Medication patient preview"
          src={previewUrl}
          style={{ width: '100%', minHeight: '1040px', border: 'none', display: 'block', background: '#ffffff' }}
        />
      </div>
    </Modal>
  );
};

export default MedicationPreviewModal;
