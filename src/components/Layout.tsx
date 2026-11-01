import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, MapPin, Users, Radio, FileText, CheckSquare, Settings as SettingsIcon, Lock } from 'lucide-react';
import { useStore } from '../state/store';

const NAV = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/islands', label: 'Islands', icon: MapPin },
  { to: '/persons', label: 'Persons', icon: Users },
  { to: '/informants', label: 'Sources', icon: Radio },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard', '/islands': 'Islands', '/persons': 'Persons', '/informants': 'Informants',
  '/reports': 'Reports', '/tasks': 'Tasks', '/settings': 'Settings',
};

export const Layout: React.FC = () => {
  const { lock } = useStore();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Like a native navigation bar: on a new screen start at the top, and show
  // the small centered title once the large title scrolls away.
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
    setScrolled(false);
    const onScroll = () => setScrolled(el.scrollTop > 36);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className={`app-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-title">{TITLES[pathname] ?? 'Atoll Info'}</div>
        <div className="header-actions">
          <NavLink to="/settings" className="glass-btn round" aria-label="Settings"><SettingsIcon size={20} /></NavLink>
          <button className="glass-btn round" onClick={lock} aria-label="Lock"><Lock size={19} /></button>
        </div>
      </header>
      <main className="app-main" ref={mainRef}>
        <div key={pathname} className="page-enter"><Outlet /></div>
      </main>
      <nav className="bottom-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Icon size={22} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
