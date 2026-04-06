import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMedicationCatalog } from '../medicationCatalog';
import { getMedicationIcon } from '../medicationIcons';

const Demo: React.FC = () => {
  const navigate = useNavigate();
  const { medicationMap } = useMedicationCatalog();

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: '#005eb8',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '2rem',
          fontSize: '0.9rem',
          fontWeight: '600'
        }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', color: '#212b32', marginBottom: '0.5rem' }}>MyMedInfo Demo</h1>
        <p style={{ fontSize: '1rem', color: '#4c6272', margin: 0 }}>
          Clear, Trusted Medication Information
        </p>
      </div>

      <div style={{ marginBottom: '3rem', padding: '1.5rem', background: '#eef7ff', borderRadius: '8px', border: '1px solid #005eb8' }}>
        <h2 style={{ fontSize: '1.1rem', color: '#005eb8', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>Medication Selection</h2>
        <p style={{ color: '#4c6272', margin: 0, fontSize: '0.95rem' }}>
          Click on any medication card below to view detailed information
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {Object.entries(medicationMap).map(([key, item]) => (
          <div
            key={key}
            onClick={() => navigate(`/patient?code=${key}`)}
            className="resource-card"
            style={{
              textAlign: 'center',
              padding: '1.5rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '1px solid #d8dde0',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ color: '#005eb8', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              {getMedicationIcon(key, 32)}
            </div>
            <h3 style={{ fontSize: '1rem', color: '#212b32', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
              {item.title}
            </h3>
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor:
                  item.badge === 'NEW'
                    ? '#e3f2fd'
                    : item.badge === 'REAUTH'
                    ? '#f0f4f5'
                    : '#f5f5f5',
                color:
                  item.badge === 'NEW'
                    ? '#005eb8'
                    : item.badge === 'REAUTH'
                    ? '#212b32'
                    : '#4c6272',
              }}
            >
              {item.badge}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', padding: '1.5rem', background: '#f5f7fa', borderRadius: '8px', border: '1px solid #d8dde0' }}>
        <h2 style={{ fontSize: '1.1rem', color: '#212b32', marginBottom: '1rem', margin: '0 0 1rem 0' }}>About the Demo</h2>
        <p style={{ color: '#4c6272', margin: 0, lineHeight: '1.6' }}>
          This demo shows how patients interact with the MyMedInfo system. Click on any medication card above to view detailed information about that medication. The system provides clear, trusted medication information in an easy-to-understand format.
        </p>
      </div>
    </div>
  );
};

export default Demo;
