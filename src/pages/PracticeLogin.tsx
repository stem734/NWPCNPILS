import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { resolvePath } from '../subdomainUtils';
import LoginForm from '../components/LoginForm';

const normaliseAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password';
  }

  if (message.includes('email not confirmed')) {
    return 'Your account email is not confirmed yet. Please use the invite link from your administrator.';
  }

  return 'Unable to sign in right now. Please try again in a moment.';
};

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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

      try {
        await supabase.functions.invoke('record-login-audit', {
          body: { portal: 'practice', userAgent: navigator.userAgent },
        });
      } catch (auditError) {
        console.warn('Login audit failed:', auditError);
      }
      navigate(resolvePath('/practice/dashboard'));
    } catch (authError) {
      console.error('Practice sign-in failed:', authError);
      setError(normaliseAuthError(authError));
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
      setError('');
    } catch {
      setError('Unable to send reset email. Check the address and try again.');
    }
  };

  return (
    <LoginForm
      title="Practice Portal"
      subtitle="MyMedInfo - Practice Portal"
      icon={null}
      email={email}
      password={password}
      error={error}
      resetSent={resetSent}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
      onResetPassword={handleResetPassword}
      submitLabel="Sign In"
      resetLabel="Forgot password? Reset it here"
    />
  );
};

export default PracticeLogin;
