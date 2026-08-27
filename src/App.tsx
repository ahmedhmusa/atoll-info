import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider, useStore } from './state/store';
import { LockScreen } from './components/LockScreen';
import { Layout } from './components/Layout';

import Dashboard from './pages/Dashboard';
import Islands from './pages/Islands';
import Persons from './pages/Persons';
import Informants from './pages/Informants';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';

const ActivityTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { touchActivity, locked } = useStore();
  useEffect(() => {
    if (locked) return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => touchActivity();
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, handler));
  }, [touchActivity, locked]);
  return <>{children}</>;
};

const Gate: React.FC = () => {
  const { ready, locked } = useStore();
  if (!ready) return <div className="lock-screen"><div className="lock-sub">Loading…</div></div>;
  if (locked) return <LockScreen />;
  return (
    <ActivityTracker>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/islands" element={<Islands />} />
            <Route path="/persons" element={<Persons />} />
            <Route path="/informants" element={<Informants />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ActivityTracker>
  );
};

const App: React.FC = () => (
  <StoreProvider>
    <Gate />
  </StoreProvider>
);

export default App;
