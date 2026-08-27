import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// NOTE: `base` must match your GitHub Pages repo name, e.g. https://<user>.github.io/<repo>/
// If you deploy to a custom domain or to the root of github.io, change base to '/'.
const REPO_BASE = '/atoll-info/'

export default defineConfig({
  base: REPO_BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // we ship a static manifest.webmanifest in /public
      workbox: {
        // App shell + static assets only. No API caching — this app never calls
        // a remote API for operational data, so there is nothing sensitive to cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // jsPDF ships an optional html2canvas-based `.html()` renderer as a
        // dynamic-import chunk. Nothing in this app calls that method (PDF
        // export here rasterizes our own SVG via a plain <canvas>), so the
        // chunk is unreachable dead code — excluding it from precache trims
        // the offline-install size without breaking anything at runtime.
        globIgnores: ['**/html2canvas-*.js'],
        navigateFallback: `${REPO_BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // require explicit "update" action so a lock/session isn't torn down mid-use
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    sourcemap: false, // avoid shipping source maps that make reverse-engineering the crypto layer easier
    target: 'es2020',
  },
})
