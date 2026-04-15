import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for expired link error in hash (implicit flow)
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      if (hashParams.get('error_code') === 'otp_expired') {
        setLinkExpired(true);
        return;
      }
    }

    // Check for error in query params (PKCE flow)
    if (searchParams.get('error_code') === 'otp_expired') {
      setLinkExpired(true);
      return;
    }

    // PKCE flow: exchange the ?code= param for a session
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error('Code exchange failed:', exchangeError.message);
          setLinkExpired(true);
        } else {
          setSessionReady(true);
        }
      });
      return;
    }

    // Implicit flow: Supabase picks up recovery token from the URL hash
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
  }, [searchParams]);

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

  if (linkExpired) {
    const handleResend = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: 'https://www.mymedinfo.info/reset-password',
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setResendSent(true);
      }
    };

    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <ShieldCheck size={48} color="#d5281b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Link Expired</h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            This password reset link has expired. Enter your email below to receive a new one.
          </p>

          {resendSent ? (
            <div style={{ padding: '0.75rem', background: '#e8f5e9', color: '#007f3b', borderRadius: '8px', fontSize: '0.9rem' }}>
              A new reset link has been sent to {resendEmail}. Please check your inbox.
            </div>
          ) : (
            <form onSubmit={handleResend}>
              {error && (
                <div style={{ padding: '0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>Email</label>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '0.75rem', border: '2px solid #d8dde0',
                    borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'
                  }}
                />
              </div>
              <button
                type="submit"
                className="action-button"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Send New Reset Link
              </button>
            </form>
          )}
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
