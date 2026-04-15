import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { LogOut, Home, FlaskConical, Settings } from 'lucide-react';
import { getSubdomain, resolvePath } from '../subdomainUtils';

type UserRole = 'admin' | 'practice' | null;

const HeaderNav: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const subdomain = getSubdomain();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
            <Settings size={16} /> Dashboard
          </button>
          <button
            onClick={() => navigate(resolvePath('/admin/drug-builder'))}
            className={`header-nav-link ${['/admin/drug-builder', '/drug-builder'].includes(location.pathname) ? 'header-nav-link--active' : ''}`}
            title="Go to Drug Builder"
          >
            <FlaskConical size={16} /> Drug Builder
          </button>
        </>
      )}

      {isPractice && (
        <button
          onClick={() => navigate(resolvePath('/practice/dashboard'))}
          className={`header-nav-link ${['/practice/dashboard', '/dashboard'].includes(location.pathname) ? 'header-nav-link--active' : ''}`}
          title="Go to Practice Dashboard"
        >
          <Settings size={16} /> Dashboard
        </button>
      )}

      <button
        onClick={() => navigate('/')}
        className={`header-nav-link ${location.pathname === '/' ? 'header-nav-link--active' : ''}`}
        title="Go to home page"
      >
        <Home size={16} /> Home
      </button>

      <button
        onClick={handleSignOut}
        className="header-nav-link header-nav-link--signout"
        title="Sign out"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </nav>
  );
};

export default HeaderNav;
