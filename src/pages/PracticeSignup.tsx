import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { FlaskConical, CheckCircle } from 'lucide-react';

const PracticeSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [odsCode, setOdsCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const docId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      await addDoc(collection(db, 'practices'), {
        name: name.trim(),
        name_lowercase: name.trim().toLowerCase(),
        ods_code: odsCode.trim().toUpperCase(),
        contact_email: contactEmail.trim(),
        contact_name: contactName.trim(),
        is_active: false, // Requires admin approval
        signed_up_at: Timestamp.now(),
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Signup error:', err);
      setError('There was a problem submitting your registration. Please try again.');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={64} color="#007f3b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: '#007f3b' }}>Registration Submitted</h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            Thank you for registering <strong>{name}</strong>.
            Your application is now pending review by the NWPCN team.
          </p>
          <div style={{ padding: '1rem', background: '#eef7ff', borderRadius: '8px', borderLeft: '4px solid #005eb8' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              <strong>What happens next?</strong><br />
              We will review your application and activate your practice.
              You will receive confirmation at <strong>{contactEmail}</strong> once approved.
              No changes to your SystmOne protocol are needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <FlaskConical size={48} color="#005eb8" style={{ marginBottom: '0.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Practice Registration</h1>
          <p style={{ color: '#4c6272' }}>Register your practice for NWPCN Patient Information Leaflet Service</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Organisation Name *
            </label>
            <p style={{ fontSize: '0.8rem', color: '#4c6272', margin: '0 0 0.5rem' }}>
              Enter the exact name as it appears in SystmOne
            </p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Riverside Medical Centre"
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              ODS Code *
            </label>
            <input
              type="text"
              value={odsCode}
              onChange={e => setOdsCode(e.target.value)}
              required
              placeholder="e.g. C84001"
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Contact Name *
            </label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              required
              placeholder="e.g. Dr Sarah Jones"
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
              Contact Email *
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              required
              placeholder="e.g. sarah.jones@nhs.net"
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ padding: '1rem', background: '#fff9c4', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <strong>Important:</strong> The Organisation Name must match exactly what appears in SystmOne.
            This is how the system identifies your practice when patients access medication information.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="action-button"
            style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Submitting...' : 'Register Practice'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PracticeSignup;
