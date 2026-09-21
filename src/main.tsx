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

  // Some iOS versions give installed home-screen apps a drawing area that
  // already stops above the home-indicator strip. In that case adding the
  // usual bottom inset again pushes the tab labels out of view, so only
  // add it when the app really does reach the bottom edge of the screen.
  const standalone = (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const portrait = window.innerHeight > window.innerWidth;
  const screenH = Math.max(window.screen.width, window.screen.height);
  const shortBy = standalone && portrait ? screenH - window.innerHeight : 0;
  if (shortBy > 20) {
    document.documentElement.style.setProperty('--nav-bottom-pad', '4px');
  } else {
    document.documentElement.style.removeProperty('--nav-bottom-pad');
  }
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
