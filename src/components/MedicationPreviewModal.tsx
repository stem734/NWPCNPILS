import React from 'react';
import { Eye } from 'lucide-react';
import type { MedContent } from '../medicationData';
import { resolvePath } from '../subdomainUtils';
import Modal from './Modal';

type MedicationPreviewModalProps = {
  med: MedContent;
  onClose: () => void;
};

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return Math.abs(hash).toString(36);
};

const MedicationPreviewModal: React.FC<MedicationPreviewModalProps> = ({ med, onClose }) => {
  const previewPayload = React.useMemo(() => JSON.stringify({
    cards: [
      {
        ...med,
        state: 'custom',
        code: med.code,
      },
    ],
  }), [med]);
  const previewToken = React.useMemo(
    () => `medication-preview:${med.code}:${stableHash(previewPayload)}`,
    [med.code, previewPayload],
  );
  const [readyToken, setReadyToken] = React.useState('');

  React.useLayoutEffect(() => {
    try {
      window.sessionStorage.setItem(previewToken, previewPayload);
      setReadyToken(previewToken);
    } catch {
      // sessionStorage may be unavailable; this preview route depends on it.
      setReadyToken('');
    }
  }, [previewPayload, previewToken]);

  const previewUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      type: 'meds',
      previewOnly: '1',
      previewToken,
      codes: med.code,
    });

    return `${window.location.origin}${resolvePath('/patient')}?${params.toString()}`;
  }, [med.code, previewToken]);

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
        {readyToken === previewToken ? (
          <iframe
            key={previewUrl}
            title="Medication patient preview"
            src={previewUrl}
            style={{ width: '100%', minHeight: '1040px', border: 'none', display: 'block', background: '#ffffff' }}
          />
        ) : (
          <div className="card patient-state-card" style={{ textAlign: 'center' }}>
            <p style={{ marginTop: '1rem', color: '#4c6272' }}>Preparing preview...</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MedicationPreviewModal;
