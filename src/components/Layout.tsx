import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MapPin, Users, Radio, FileText, CheckSquare, Settings as SettingsIcon, Lock } from 'lucide-react';
import { useStore } from '../state/store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/islands', label: 'Islands', icon: MapPin },
  { to: '/persons', label: 'Persons', icon: Users },
  { to: '/informants', label: 'Informants', icon: Radio },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
];

export const Layout: React.FC = () => {
  const { settings, lock } = useStore();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Atoll Info</h1>
          <div className="subtitle">{settings?.agencyLabel}</div>
        </div>
        <div className="header-actions">
          <NavLink to="/settings" className="icon-btn" aria-label="Settings"><SettingsIcon size={15} /></NavLink>
          <button className="icon-btn" onClick={lock}><Lock size={13} /> Lock</button>
        </div>
      </header>
      <main className="app-main"><Outlet /></main>
      <nav className="bottom-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon"><Icon size={20} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
