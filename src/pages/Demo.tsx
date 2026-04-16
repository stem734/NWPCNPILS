import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Shuffle } from 'lucide-react';
import { buildDemoPatientUrl, DEMO_VARIATIONS, getRandomDemoVariation } from '../demoHelpers';

const Demo: React.FC = () => {
  const navigate = useNavigate();

  const openDemo = (index: number) => {
    const variation = DEMO_VARIATIONS[index];
    navigate(`${buildDemoPatientUrl(variation)}&demo=1`);
  };

  const openRandomDemo = () => {
    const variation = getRandomDemoVariation();
    navigate(`${buildDemoPatientUrl(variation)}&demo=1`);
  };

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

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', color: '#212b32', marginBottom: '0.5rem' }}>MyMedInfo Demo</h1>
        <p style={{ fontSize: '1rem', color: '#4c6272', margin: 0 }}>
          Pick an example patient view or load a random one.
        </p>
      </div>

      <div className="patient-demo-banner" style={{ marginBottom: '1.5rem' }}>
        This is dummy information only and should not be used for clinical decisions.
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <button
          onClick={openRandomDemo}
          className="action-button"
          style={{ backgroundColor: '#212b32', color: 'white', justifyContent: 'center' }}
        >
          <Shuffle size={18} /> Random demo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {DEMO_VARIATIONS.map((variation, index) => (
          <button
            key={`${variation.forename}-${index}`}
            onClick={() => openDemo(index)}
            className="resource-card"
            style={{
              textAlign: 'left',
              padding: '1.25rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '1px solid #d8dde0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', color: '#005eb8' }}>
              <Monitor size={22} />
              <strong>Example {index + 1}</strong>
            </div>
            <div style={{ fontWeight: 700, color: '#212b32', marginBottom: '0.35rem' }}>
              Hi {variation.forename}, {variation.practiceName}
            </div>
            <div style={{ color: '#4c6272', fontSize: '0.92rem', marginBottom: '0.35rem' }}>
              NHS No: {variation.nhsNumber}
            </div>
            <div style={{ color: '#4c6272', fontSize: '0.92rem' }}>
              Codes: {variation.codes.replace(/,/g, ', ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Demo;
