import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';

/**
 * Two separate viewport-height custom properties, because one value can't
 * correctly serve both purposes:
 *
 * `--app-vh`  — the REAL full-screen height, from `window.innerHeight`.
 *   Used for the app shell / bottom nav so they always reach the true
 *   bottom edge of the screen. `dvh` alone is unreliable for this in
 *   standalone (installed) PWA mode on some iOS versions — it can
 *   under-report the screen height, leaving a visible gap below the nav
 *   bar. This never shrinks for the on-screen keyboard, which is exactly
 *   what we want here: the nav bar/shell shouldn't resize when a modal's
 *   input is focused.
 *
 * `--visible-vh` — the currently VISIBLE height, from
 *   `visualViewport.height`, which does shrink when the keyboard opens.
 *   Used only by the modal sheet's max-height, so a form's Save button
 *   stays scrollable into view above the keyboard instead of hiding
 *   behind it.
 */
function setViewportHeights() {
  document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
  const visible = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--visible-vh', `${visible * 0.01}px`);
}

setViewportHeights();
window.addEventListener('resize', setViewportHeights);
window.addEventListener('orientationchange', setViewportHeights);
window.visualViewport?.addEventListener('resize', setViewportHeights);
window.visualViewport?.addEventListener('scroll', setViewportHeights);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
