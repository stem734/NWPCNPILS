import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically picks up the recovery token from the URL hash
    // and establishes a session. We listen for that event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <ShieldCheck size={48} color="#007f3b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Password Updated</h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            Your password has been set successfully. You can now sign in.
          </p>
          <button
            className="action-button"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/admin')}
          >
            Go to Admin Login
          </button>
          <button
            className="action-button"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', background: '#4c6272' }}
            onClick={() => navigate('/practice')}
          >
            Go to Practice Login
          </button>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <ShieldCheck size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Set Your Password</h1>
          <p style={{ color: '#4c6272' }}>
            Verifying your reset link... If this takes too long, the link may have expired.
            Please request a new password reset.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <ShieldCheck size={48} color="#005eb8" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Set Your Password</h1>
        <p style={{ color: '#4c6272', marginBottom: '2rem' }}>MyMedInfo</p>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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
            style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
