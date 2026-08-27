# Tha Atoll Drug Intelligence Management System (Atoll DIMS)

A simple, offline, encrypted Progressive Web App for a **single authorized
officer** to track drug-intelligence casework across the 13 inhabited
islands of Tha Atoll — installable on an iPhone or Android phone, with
everything stored **only on that device**.

> FOR AUTHORIZED OFFICIAL USE ONLY. Categories like "Suspected Dealer" are
> investigative leads, not findings of guilt.

## What it does

- **Dashboard** — suspected sellers vs. suspected users at a glance (split
  out, not lumped together), informant/report counts, recent reports, open
  tasks, and a quick "+ Add Task" button right there.
- **Islands** — all 13 islands, each showing sellers and users counted and
  listed **separately**. Tap an island to see the actual names in each group.
- **Persons** — name, alias, island, category (Person of Interest / Suspected
  User / Suspected Dealer / Cleared), notes.
- **Informants** — a confidential code name, island, reliability, notes.
  Real identities are never asked for or shown — that's the point of a code name.
- **Reports** — title, island, date, confidence, description, open/closed status.
- **Tasks** — title, due date, priority, done/open — addable from the
  Dashboard or the Tasks tab.
- **Settings** — officer/agency name, auto-lock timeout, PIN change, and a
  "wipe all data" reset.

That's it — no network module, no attachments, no backup file, no biometric
login, no configurable grading systems. Those were cut on purpose to keep
this small enough to actually use one-handed on a phone.

## Where your data lives

**On your phone. Only on your phone.** Specifically:

- Everything is stored in the browser's **IndexedDB**, inside the installed
  PWA. There is no server, no account, and no sync of any kind.
- Every record is **encrypted with AES-GCM (256-bit)** using a key derived
  from your PIN via **PBKDF2-SHA256** (250,000 iterations) — see
  `src/lib/crypto.ts`. The raw database never contains a plaintext name,
  note, or any other detail — only ciphertext.
- The app makes **zero network requests** for its own data. Check
  `src/lib/db.ts` and `src/state/store.tsx` — there's no `fetch` or
  `XMLHttpRequest` call anywhere in them.
- No `localStorage`/`sessionStorage`, no analytics, no third-party scripts,
  no CDN dependency — everything is bundled into the app at build time.
- The PIN is never stored anywhere, only its PBKDF2-derived key material
  used transiently in memory. **If you forget your PIN, there is no way to
  recover the data** — that's the intended trade-off for not having a
  server-side "reset password" flow.
- The app auto-locks after a period of inactivity (configurable in
  Settings, default 5 minutes) and has a manual "🔒 Lock" button in the header.

Because there's no backup/export feature in this version, uninstalling the
app or clearing site data on your phone will permanently delete everything.
If that's a problem for your workflow, say so and a backup/export feature
can be added back in.

## Tech stack

- React + TypeScript + Vite
- `idb` (thin wrapper over IndexedDB)
- `react-router-dom` (HashRouter — works on GitHub Pages with no server config)
- Native Web Crypto API for encryption — no external crypto library
- `vite-plugin-pwa` for the installable app + offline service worker

## Project structure

```
atoll-dims/
├── .github/workflows/deploy.yml   # CI: build + deploy to GitHub Pages
├── public/
│   ├── manifest.webmanifest
│   └── icons/
├── src/
│   ├── main.tsx / App.tsx
│   ├── types/index.ts             # Island, Person, Informant, Report, TaskItem
│   ├── lib/
│   │   ├── crypto.ts              # PBKDF2 + AES-GCM
│   │   ├── db.ts                  # IndexedDB, ciphertext-only stores
│   │   ├── seed.ts                # the 13 islands
│   │   └── util.ts
│   ├── state/store.tsx            # PIN lock/unlock, auto-lock, encrypted CRUD
│   ├── components/
│   │   ├── LockScreen.tsx
│   │   ├── Layout.tsx             # header + 6-tab bottom nav
│   │   ├── Modal.tsx
│   │   └── Badge.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx          # incl. quick "+ Add Task"
│   │   ├── Islands.tsx            # sellers vs. users, per island
│   │   ├── Persons.tsx
│   │   ├── Informants.tsx
│   │   ├── Reports.tsx
│   │   ├── Tasks.tsx
│   │   └── Settings.tsx
│   └── styles/global.css          # light/dark via CSS variables + prefers-color-scheme
├── vite.config.ts
└── package.json
```

## Running it locally

```bash
npm install
npm run dev
```

## Building

```bash
npm run build     # type-checks then builds to dist/
npm run preview   # serve the production build locally
```

## Deploying to GitHub Pages (so you can install it on your phone)

1. Create a new GitHub repository and push this project to it, e.g.
   `github.com/<you>/atoll-dims`.
2. In the repo, go to **Settings → Pages** and set the source to
   **GitHub Actions**.
3. Push to `main` — the included workflow
   (`.github/workflows/deploy.yml`) builds the app and deploys it
   automatically.
4. **If your repository name isn't `atoll-dims`**, edit `REPO_BASE` in
   `vite.config.ts` to `/<your-repo-name>/` (and `start_url`/`scope` in
   `public/manifest.webmanifest` to match) before pushing.
5. Once the Action finishes, open the Pages URL shown in the repo's
   **Settings → Pages** page — on your iPhone, in Safari.
6. Tap the Share icon → **Add to Home Screen**. This installs it as a
   real app icon; opening it from there runs it full-screen with no
   Safari address bar.
7. After that first load, it keeps working with the phone in airplane
   mode — the service worker caches the app itself, and all your data
   was always local anyway.

## What must never go in this GitHub repo

Only source code, config, icons, and docs belong here. **Never commit**
real intelligence data, real names, real informant details, or anything
resembling actual casework — this repo is public-deployable app code, not
a place to store operational information. Use only fictional data for any
local testing.
