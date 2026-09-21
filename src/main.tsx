import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';

/**
 * The app shell is pinned to all four screen edges in CSS (no height
 * measurement needed). The only height we still track is the currently
 * VISIBLE area — which shrinks when the on-screen keyboard opens — so a
 * form sheet's max-height fits above the keyboard and its Save button
 * stays reachable.
 */
function setVisibleHeight() {
  const visible = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--visible-vh', `${visible * 0.01}px`);
}

setVisibleHeight();
window.addEventListener('resize', setVisibleHeight);
window.addEventListener('orientationchange', setVisibleHeight);
window.visualViewport?.addEventListener('resize', setVisibleHeight);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
