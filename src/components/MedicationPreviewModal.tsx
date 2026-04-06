import React from 'react';
import { ExternalLink, Eye, FlaskConical, Info, ShieldAlert, X } from 'lucide-react';
import type { MedContent } from '../medicationData';
import { getMedicationIcon } from '../medicationIcons';

type MedicationPreviewModalProps = {
  med: MedContent;
  onClose: () => void;
};

const MedicationPreviewModal: React.FC<MedicationPreviewModalProps> = ({ med, onClose }) => {
  return (
    <div
      onClick={onClose}
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
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: 'white',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #d8dde0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRadius: '12px 12px 0 0',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Eye size={20} color="#005eb8" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#005eb8' }}>Patient Preview</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272', padding: '0.25rem' }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '1rem',
              letterSpacing: '0.05em',
              background: med.badge === 'NEW' ? '#005eb8' : med.badge === 'REAUTH' ? '#007f3b' : '#4c6272',
              color: 'white',
            }}
          >
            {med.badge === 'NEW' ? 'NEW MEDICATION' : med.badge === 'REAUTH' ? 'ANNUAL REVIEW' : 'MEDICATION INFORMATION'}
          </span>

          {med.badge === 'NEW' && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#eef7ff',
                borderRadius: '8px',
                borderLeft: '4px solid #005eb8',
              }}
            >
              <div style={{ fontWeight: 700, color: '#005eb8', marginBottom: '0.25rem' }}>Beginning Your Treatment</div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#212b32' }}>
                You are starting a new course of treatment. This information will help you understand your medication and how to take it safely.
              </p>
            </div>
          )}

          {med.badge === 'REAUTH' && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#f0f4f5',
                borderRadius: '8px',
                borderLeft: '4px solid #005eb8',
              }}
            >
              <div style={{ fontWeight: 700, color: '#212b32', marginBottom: '0.25rem' }}>Annual Treatment Reminder</div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#4c6272' }}>
                As you have been taking this medication for 12 months or more, we are sending this as a routine review reminder of safe management.
              </p>
            </div>
          )}

          <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#005eb8', display: 'flex' }}>{getMedicationIcon(med.code)}</span>
            {med.title}
          </h2>
          <p style={{ color: '#212b32', fontSize: '1rem', lineHeight: 1.6 }}>{med.description}</p>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Key Information</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {med.keyInfo.map((info, index) => (
                <li
                  key={`${med.code}-info-${index}`}
                  style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}
                >
                  <Info size={20} color="#005eb8" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span style={{ fontSize: '0.95rem' }}>{info}</span>
                </li>
              ))}
            </ul>
          </div>

          {med.sickDaysNeeded && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fde8e8',
                borderRadius: '8px',
                borderLeft: '4px solid #d5281b',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <ShieldAlert size={20} color="#d5281b" />
                <strong style={{ color: '#d5281b' }}>Sick Day Rules Apply</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#212b32' }}>
                If you become unwell and are unable to eat or drink normally, you may need to pause this medication.
              </p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Linked Resources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {med.nhsLink && (
                <a
                  href={med.nhsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: '#eef7ff',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ background: '#005eb8', color: 'white', padding: '0.15rem 0.4rem', fontWeight: 800, fontSize: '0.7rem', borderRadius: '2px' }}>NHS</div>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>Official NHS Guidance</span>
                  <ExternalLink size={16} color="#005eb8" />
                </a>
              )}
              {med.trendLinks.map((link, index) => (
                <a
                  key={`${med.code}-link-${index}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: '#f0f9f0',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <FlaskConical size={16} color="#007f3b" />
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{link.title}</span>
                  <ExternalLink size={16} color="#007f3b" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#f8fafb',
            borderTop: '1px solid #d8dde0',
            borderRadius: '0 0 12px 12px',
            fontSize: '0.8rem',
            color: '#4c6272',
            textAlign: 'center',
          }}
        >
          This is a preview of what patients will see when they access this medication block.
        </div>
      </div>
    </div>
  );
};

export default MedicationPreviewModal;
