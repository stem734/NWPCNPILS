import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type DisclaimerDialogProps = {
  title: string;
  message: string;
  checkboxLabel: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const DisclaimerDialog: React.FC<DisclaimerDialogProps> = ({
  title,
  message,
  checkboxLabel,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: '#fff7e6',
            borderBottom: '2px solid #fa8c16',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={24} color="#d46b08" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#9a3412' }}>{title}</h2>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, lineHeight: 1.7, color: '#212b32' }}>{message}</p>

          <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', lineHeight: 1.5, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '0.15rem', flexShrink: 0 }}
            />
            <span>{checkboxLabel}</span>
          </label>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #d8dde0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onCancel}
            className="action-button"
            style={{ backgroundColor: '#4c6272' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!accepted}
            className="action-button"
            style={{
              backgroundColor: accepted ? '#d46b08' : '#d8dde0',
              cursor: accepted ? 'pointer' : 'not-allowed',
              opacity: accepted ? 1 : 0.8,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerDialog;
