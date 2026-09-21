import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App.tsx';

/**
 * iOS Safari's `dvh` unit is unreliable in standalone (installed) PWA mode
 * on some iOS versions — it can under-report the real visible screen
 * height, leaving a gap between the fixed-height app shell and the actual
 * bottom of the screen (the bottom nav then appears "floating" mid-screen,
 * and anything anchored below it, like a modal's action button, can end up
 * unreachable). This measures the *real* visible viewport directly via
 * `window.innerHeight` / `visualViewport` — which also correctly shrinks
 * when the on-screen keyboard appears — and exposes it as `--app-vh`,
 * which global.css uses instead of `dvh` for every full-height layout.
 */
function setAppViewportHeight() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${h * 0.01}px`);
}

setAppViewportHeight();
window.addEventListener('resize', setAppViewportHeight);
window.addEventListener('orientationchange', setAppViewportHeight);
window.visualViewport?.addEventListener('resize', setAppViewportHeight);
window.visualViewport?.addEventListener('scroll', setAppViewportHeight);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
