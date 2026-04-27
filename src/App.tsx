import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PracticeSignup from './pages/PracticeSignup';
import PracticeLogin from './pages/PracticeLogin';
import PracticeDashboard from './pages/PracticeDashboard';
import CardBuilder from './pages/CardBuilder';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import ResetPassword from './pages/ResetPassword';
import PatientRouter from './pages/PatientRouter';
import LegalPage from './pages/LegalPage';
import { supabase } from './supabase';
import { getSubdomain } from './subdomainUtils';
import PatientGuidanceNotice from './components/PatientGuidanceNotice';
import HeaderNav from './components/HeaderNav';

declare const __APP_COMMIT_COUNT__: string;
declare const __APP_COMMIT_HASH__: string;

const ClinicianDemo: React.FC<{ show?: boolean }> = ({ show = true }) => {
  if (!show) return null;

  return null;
};

const SubdomainRoutes: React.FC = () => {
  const subdomain = getSubdomain();

  if (subdomain === 'admin') {
    return (
      <Routes>
        <Route path="/" element={<AdminLogin />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/drug-builder" element={<CardBuilder />} />
        <Route path="/card-builder" element={<CardBuilder />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  if (subdomain === 'practice') {
    return (
      <Routes>
        <Route path="/" element={<PracticeLogin />} />
        <Route path="/dashboard" element={<PracticeDashboard />} />
        <Route path="/signup" element={<PracticeSignup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  // Default: main domain (www.mymedinfo.info / localhost)
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/patient" element={<PatientRouter />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/signup" element={<PracticeSignup />} />
      <Route path="/admin/drug-builder" element={<CardBuilder />} />
      <Route path="/admin/card-builder" element={<CardBuilder />} />
      <Route path="/practice" element={<PracticeLogin />} />
      <Route path="/practice/dashboard" element={<PracticeDashboard />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showClinicianDemo = location.pathname === '/patient' || location.pathname === '/demo';
  const showPatientGuidance = location.pathname === '/patient';
  const versionLabel = `0.0.1+${__APP_COMMIT_COUNT__}`;

  // Detect implicit-flow Supabase auth recovery tokens in the URL hash
  // and redirect to /reset-password. The PKCE ?code= flow is NOT handled
  // here — the reset email links directly to /reset-password?code=... so
  // no redirect is needed, and intercepting it here would cause a re-render
  // that re-initialises the Supabase client and consumes the one-time code.
  useEffect(() => {
    if (location.pathname === '/reset-password') return;

    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      if (hashParams.get('type') === 'recovery' || hashParams.get('error_code') === 'otp_expired') {
        navigate('/reset-password' + window.location.hash, { replace: true });
      }
    }
  }, [location, navigate]);

  // Listen for PASSWORD_RECOVERY event and redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY' && location.pathname !== '/reset-password') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [location, navigate]);

  return (
    <div className="app-container">
      <a href="#main-content" className="sr-only">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-header__logo-link" href="/" aria-label="MyMedInfo home">
            <img className="site-header__logo" src="/nhs-wordmark-blue.jpg" alt="NHS" />
            <span className="site-header__service">MyMedInfo</span>
          </a>
          <HeaderNav />
        </div>
      </header>
      <main id="main-content">
        <SubdomainRoutes />
        {showPatientGuidance && (
          <PatientGuidanceNotice text="For guidance only. Follow the specific advice from your GP or clinical team. This information is stored on this device and will be removed if you clear your browser." />
        )}
      </main>

      <footer className="footer">
        <span className="footer__border" aria-hidden="true" />
        <div className="footer__container">
          <img className="footer__logo" src="/nhs-wordmark-blue.jpg" alt="NHS" />
          <nav className="footer__links" aria-label="Footer links">
            <a href="https://service-manual.nhs.uk/" target="_blank" rel="noopener noreferrer">Service Manual</a>
            <a href="https://design-system.nhs.uk/" target="_blank" rel="noopener noreferrer">Figma How To's</a>
          </nav>
          <div className="footer__divider" aria-hidden="true" />
          <div className="footer__meta">
            <p className="footer__copyright">
              © {new Date().getFullYear()} <a href="https://www.nottinghamwestpcn.co.uk/" target="_blank" rel="noopener noreferrer">Nottingham West Primary Care Network</a> - MyMedInfo
            </p>
            <p className="footer__version" title={`Commit ${__APP_COMMIT_HASH__}`}>
              <span className="footer__beta">Beta</span>
              <span>Version {versionLabel}</span>
            </p>
          </div>
        </div>
      </footer>

      <ClinicianDemo show={showClinicianDemo} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
