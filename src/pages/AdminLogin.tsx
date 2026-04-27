import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { resolvePath } from '../subdomainUtils';
import LoginForm from '../components/LoginForm';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session?.user) {
        navigate(resolvePath('/admin/dashboard'), { replace: true });
      }
    };

    void hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate(resolvePath('/admin/dashboard'), { replace: true });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Enter your email address first');
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setResetSent(true);
      setError('');
    } catch {
      setError('Unable to send reset email. Check the address and try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      try {
        await supabase.functions.invoke('record-login-audit', {
          body: { portal: 'admin', userAgent: navigator.userAgent },
        });
      } catch (auditError) {
        console.warn('Login audit failed:', auditError);
      }
      navigate(resolvePath('/admin/dashboard'));
    } catch {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <LoginForm
      title="Admin Login"
      subtitle="MyMedInfo Administration"
      icon={<ShieldAlert size={48} color="var(--nhs-blue)" />}
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

export default AdminLogin;
