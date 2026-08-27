import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../state/store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '\u2302', end: true },
  { to: '/islands', label: 'Islands', icon: '\u26F1' },
  { to: '/persons', label: 'Persons', icon: '\u2318' },
  { to: '/informants', label: 'Informants', icon: '\u2733' },
  { to: '/reports', label: 'Reports', icon: '\u2637' },
  { to: '/tasks', label: 'Tasks', icon: '\u2611' },
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
          <NavLink to="/settings" className="icon-btn">⚙</NavLink>
          <button className="icon-btn" onClick={lock}>🔒 Lock</button>
        </div>
      </header>
      <main className="app-main"><Outlet /></main>
      <nav className="bottom-nav">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
