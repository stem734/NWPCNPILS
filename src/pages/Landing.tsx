import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Stethoscope, Zap } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <div style={{ maxWidth: '800px', width: '100%', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', color: '#212b32', marginBottom: '1rem' }}>MyMedInfo</h1>
        <p style={{ fontSize: '1.25rem', color: '#4c6272', marginBottom: '3rem' }}>Clear, Trusted Medication Information</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginTop: '3rem' }}>
          {/* Admin Login */}
          <button
            onClick={() => navigate('/admin')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#005eb8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          >
            <Shield size={48} style={{ color: '#005eb8', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Admin</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Manage medications and system settings</p>
            <span style={{
              padding: '0.75rem 1.5rem',
              background: '#005eb8',
              color: 'white',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Login as Admin
            </span>
          </button>

          {/* Practice Login */}
          <button
            onClick={() => navigate('/practice')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#007f3b';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          >
            <Stethoscope size={48} style={{ color: '#007f3b', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Practice</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Manage practice medications and content</p>
            <span style={{
              padding: '0.75rem 1.5rem',
              background: '#007f3b',
              color: 'white',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Login as Practice
            </span>
          </button>

          {/* Demo */}
          <button
            onClick={() => navigate('/demo')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#005eb8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          >
            <Zap size={48} style={{ color: '#005eb8', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Demo</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Try the live demo</p>
            <span style={{
              padding: '0.75rem 1.5rem',
              background: '#005eb8',
              color: 'white',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Launch Demo
            </span>
          </button>
        </div>

        <div style={{ marginTop: '3rem', padding: '1.5rem', background: 'rgba(255,255,255,0.8)', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.9rem', color: '#4c6272', margin: 0 }}>
            This MVP demonstrates the MyMedInfo patient medication portal with manual medication entry management.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
