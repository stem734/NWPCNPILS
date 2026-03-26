import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';

const PracticeLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/practice/dashboard');
    } catch {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch {
      setError('Unable to send reset email. Check the address and try again.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <FlaskConical size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Practice Portal</h1>
        <p style={{ color: '#4c6272', marginBottom: '2rem' }}>NWPCN Patient Information Leaflet Service</p>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {resetSent && (
          <div style={{ padding: '0.75rem', background: '#f0f9f0', color: '#007f3b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Password reset email sent. Check your inbox.
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="action-button"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <button
          onClick={handleResetPassword}
          style={{ background: 'none', border: 'none', color: '#005eb8', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
        >
          Forgot password? Reset it here
        </button>
      </div>
    </div>
  );
};

export default PracticeLogin;
