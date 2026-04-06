import React from 'react';
import { AlertCircle, X } from 'lucide-react';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
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
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            background: isDangerous ? '#fde8e8' : '#eef7ff',
            borderBottom: `2px solid ${isDangerous ? '#d5281b' : '#005eb8'}`,
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle
            size={24}
            color={isDangerous ? '#d5281b' : '#005eb8'}
            style={{ flexShrink: 0, marginTop: '0.1rem' }}
            aria-hidden="true"
          />
          <div style={{ flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: isDangerous ? '#d5281b' : '#005eb8',
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#4c6272',
              padding: '0.25rem',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#212b32', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #d8dde0',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.25rem',
              border: '1px solid #d8dde0',
              borderRadius: '8px',
              background: 'white',
              color: '#4c6272',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.6rem 1.25rem',
              border: 'none',
              borderRadius: '8px',
              background: isDangerous ? '#d5281b' : '#005eb8',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
