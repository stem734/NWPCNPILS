import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Demo: React.FC = () => {
  const navigate = useNavigate();

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

      <h1 style={{ fontSize: '2rem', color: '#212b32', marginBottom: '1rem' }}>MyMedInfo Demo</h1>
      <p style={{ fontSize: '1rem', color: '#4c6272', marginBottom: '2rem' }}>
        This is a demonstration of the MyMedInfo patient medication information portal.
      </p>

      <div style={{ background: '#f5f7fa', padding: '2rem', borderRadius: '8px', border: '1px solid #d8dde0' }}>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '6px', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', color: '#212b32', marginBottom: '1rem' }}>Demo Content Coming Soon</h2>
          <p style={{ color: '#4c6272', lineHeight: '1.6' }}>
            The demo page will showcase example medications, dosages, and patient information in the MyMedInfo system.
            Use the Admin and Practice login sections to manage and configure your practice medications.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '6px', border: '1px solid #d8dde0' }}>
            <h3 style={{ color: '#005eb8', fontSize: '1rem', marginBottom: '0.5rem' }}>👨‍⚕️ Admin Portal</h3>
            <p style={{ color: '#4c6272', fontSize: '0.9rem', margin: 0 }}>Manage system medications and settings</p>
          </div>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '6px', border: '1px solid #d8dde0' }}>
            <h3 style={{ color: '#007f3b', fontSize: '1rem', marginBottom: '0.5rem' }}>🏥 Practice Portal</h3>
            <p style={{ color: '#4c6272', fontSize: '0.9rem', margin: 0 }}>Configure practice medications and content</p>
          </div>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '6px', border: '1px solid #d8dde0' }}>
            <h3 style={{ color: '#FF9800', fontSize: '1rem', marginBottom: '0.5rem' }}>📱 Patient View</h3>
            <p style={{ color: '#4c6272', fontSize: '0.9rem', margin: 0 }}>View medication information clearly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
