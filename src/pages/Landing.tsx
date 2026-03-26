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
          <div
            onClick={() => navigate('/admin')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#2196F3';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
            }}
          >
            <Shield size={48} style={{ color: '#2196F3', marginBottom: '1rem', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Admin</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Manage medications and system settings</p>
            <button style={{
              padding: '0.75rem 1.5rem',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Login as Admin
            </button>
          </div>

          {/* Practice Login */}
          <div
            onClick={() => navigate('/practice')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#4CAF50';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
            }}
          >
            <Stethoscope size={48} style={{ color: '#4CAF50', marginBottom: '1rem', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Practice</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Manage practice medications and content</p>
            <button style={{
              padding: '0.75rem 1.5rem',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Login as Practice
            </button>
          </div>

          {/* Demo */}
          <div
            onClick={() => navigate('/demo')}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#FF9800';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
            }}
          >
            <Zap size={48} style={{ color: '#FF9800', marginBottom: '1rem', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#212b32', marginBottom: '0.5rem' }}>Demo</h2>
            <p style={{ fontSize: '0.9rem', color: '#4c6272', marginBottom: '1rem' }}>Try the live demo</p>
            <button style={{
              padding: '0.75rem 1.5rem',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}>
              Launch Demo
            </button>
          </div>
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
