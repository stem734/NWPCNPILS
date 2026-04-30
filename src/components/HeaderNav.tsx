import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { getSubdomain, resolvePath } from '../subdomainUtils';

type UserRole = 'admin' | 'practice' | null;

const HeaderNav: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const subdomain = getSubdomain();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        // Determine role based on subdomain first, then path
        if (subdomain === 'admin' || location.pathname.startsWith('/admin')) {
          setUserRole('admin');
        } else if (subdomain === 'practice' || location.pathname.startsWith('/practice')) {
          setUserRole('practice');
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname, subdomain]);

  if (!userRole) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate(resolvePath(subdomain === 'admin' ? '/admin' : subdomain === 'practice' ? '/practice' : '/'));
  };

  const isAdmin = userRole === 'admin';
  const isPractice = userRole === 'practice';

  return (
    <nav className="header-nav" aria-label="Main navigation">
      {isAdmin && (
        <>
          <button
            onClick={() => navigate(resolvePath('/admin/dashboard'))}
            className={`header-nav-link ${['/admin/dashboard', '/dashboard'].includes(location.pathname) ? 'header-nav-link--active' : ''}`}
            title="Go to Admin Dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate(resolvePath('/admin/card-builder'))}
            className={`header-nav-link ${['/admin/drug-builder', '/drug-builder', '/admin/card-builder', '/card-builder'].includes(location.pathname) ? 'header-nav-link--active' : ''}`}
            title="Go to Card Builder"
          >
            Card Builder
          </button>
        </>
      )}

      {isPractice && (
        <button
          onClick={() => navigate(resolvePath('/practice/dashboard'))}
          className={`header-nav-link ${['/practice/dashboard', '/dashboard'].includes(location.pathname) ? 'header-nav-link--active' : ''}`}
          title="Go to Practice Dashboard"
        >
          Dashboard
        </button>
      )}

      <button
        onClick={() => navigate('/')}
        className={`header-nav-link ${location.pathname === '/' ? 'header-nav-link--active' : ''}`}
        title="Go to home page"
      >
        Home
      </button>

      <button
        onClick={handleSignOut}
        className="header-nav-link header-nav-link--signout"
        title="Sign out"
      >
        Sign Out
      </button>
    </nav>
  );
};

export default HeaderNav;
