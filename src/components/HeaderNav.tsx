import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { LogOut, Home, FlaskConical, Settings } from 'lucide-react';

type UserRole = 'admin' | 'practice' | null;

const HeaderNav: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Determine role based on current path
        const path = location.pathname;
        if (path.startsWith('/admin')) {
          setUserRole('admin');
        } else if (path.startsWith('/practice')) {
          setUserRole('practice');
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname]);

  if (!userRole) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate('/');
  };

  const isAdmin = userRole === 'admin';
  const isPractice = userRole === 'practice';

  return (
    <nav className="header-nav" aria-label="Main navigation">
      {isAdmin && (
        <>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className={`header-nav-link ${location.pathname === '/admin/dashboard' ? 'header-nav-link--active' : ''}`}
            title="Go to Admin Dashboard"
          >
            <Settings size={16} /> Dashboard
          </button>
          <button
            onClick={() => navigate('/admin/drug-builder')}
            className={`header-nav-link ${location.pathname === '/admin/drug-builder' ? 'header-nav-link--active' : ''}`}
            title="Go to Drug Builder"
          >
            <FlaskConical size={16} /> Drug Builder
          </button>
        </>
      )}

      {isPractice && (
        <button
          onClick={() => navigate('/practice/dashboard')}
          className={`header-nav-link ${location.pathname === '/practice/dashboard' ? 'header-nav-link--active' : ''}`}
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
