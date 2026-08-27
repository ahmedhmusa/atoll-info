# Atoll Info

A simple, offline, encrypted Progressive Web App for a **single authorized
officer** to track drug-intelligence casework across the islands of Tha
Atoll — installable on an iPhone or Android phone, with everything stored
**only on that device**. Comes pre-loaded with the 13 inhabited islands,
but you can add, rename, or remove islands freely.

> FOR AUTHORIZED OFFICIAL USE ONLY. Categories like "Suspected Dealer" are
> investigative leads, not findings of guilt.

## What it does

- **Dashboard** — suspected sellers vs. suspected users at a glance (split
  out, not lumped together), informant/report counts, recent reports, open
  tasks, and a quick "+ Add Task" button right there. Every stat tile is
  tappable — it shows a short description of what it represents and jumps
  straight to the underlying records (e.g. tapping "Suspected Sellers"
  opens Persons pre-filtered to that category).
- **Islands** — add, rename, or delete islands yourself; a "Clear All
  Islands" option if you want to wipe the starting set and build your own
  list from scratch. Each island still shows sellers and users counted and
  listed **separately**. Tap an island to see the actual names in each group.
- **Persons** — full name, nickname, ID card number, island, **category**
  (Dealer / Drug User / Person of Interest — select any that apply),
  **types of drugs involved** (Cocaine, Heroin, Cannabis, Party Drugs,
  Alcohol, Meth — select any that apply), drug network connections
  (free text), flag status (None / Jailed / Faruvaa / On-Watch / On
  Investigation), notes, and two optional photos — a full photo and an ID
  card photo — each viewable full-screen and choosable from the camera or
  the photo gallery.
- **Informants** — a confidential code name, island, reliability, notes, and
  an optional photo. Real identities are never asked for or shown by name —
  that's the point of a code name (the app does warn that a photo can still
  reveal identity, so use it per your own source-protection judgment).
- **Reports** — title, island, date, confidence, description, open/closed status.
- **Tasks** — title, due date, priority, done/open — addable from the
  Dashboard or the Tasks tab.
- **Settings** — officer/agency name, auto-lock timeout, PIN change,
  **Backup & Restore**, and a "wipe all data" reset.

That's it — no network module, no attachments, no biometric login, no
configurable grading systems. Those were cut on purpose to keep this small
enough to actually use one-handed on a phone.

## Backup & Restore

Since everything lives only in this device's storage, losing the phone or
clearing site data means losing everything — so there's a local, encrypted
backup feature in Settings:

- **Export**: enter your PIN, and the app downloads a single encrypted
  `.json` file containing persons, informants, reports, tasks, islands, and
  settings. Save it wherever you control — Files, iCloud Drive, Google
  Drive, a USB drive. It is never uploaded anywhere automatically.
- **Restore**: pick a backup file and the app shows its date, app/database
  version, and record counts — all readable without a password — plus an
  integrity checksum check, before asking for the backup's password.
  Two modes:
  - **Merge** — only adds records that don't already exist (matched by ID;
    islands are matched by name across devices). Never overwrites anything.
  - **Full restore** — wipes this device and replaces everything with the
    backup, including its PIN.
- Both modes require typing the backup's password and an explicit
  confirmation step before anything is written — nothing is ever
  overwritten silently.

See `src/lib/backup.ts` for the file format and restore logic.

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
- Photos are resized client-side (canvas, capped around 480px) and stored
  as part of the same encrypted record — never as separate unencrypted
  files, and never uploaded anywhere. See `src/lib/util.ts`
  (`fileToResizedDataUrl`) and `src/components/PhotoField.tsx`.
- The PIN is never stored anywhere, only its PBKDF2-derived key material
  used transiently in memory. **If you forget your PIN, there is no way to
  recover the data** — that's the intended trade-off for not having a
  server-side "reset password" flow.
- The app auto-locks after a period of inactivity (configurable in
  Settings, default 5 minutes) and has a manual "🔒 Lock" button in the header.

Because there's no automatic cloud backup, uninstalling the app or
clearing site data on your phone will permanently delete everything unless
you've exported a backup first (see above).

## Tech stack

- React + TypeScript + Vite
- `idb` (thin wrapper over IndexedDB)
- `lucide-react` (SVG icon set — bundled at build time, no CDN)
- `react-router-dom` (HashRouter — works on GitHub Pages with no server config)
- Native Web Crypto API for encryption — no external crypto library
- `vite-plugin-pwa` for the installable app + offline service worker

## Project structure

```
atoll-info/
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
│   │   ├── backup.ts              # Backup file format, checksum, replace/merge restore
│   │   ├── appMeta.ts             # App/DB version constants (used in backup headers)
│   │   ├── seed.ts                # the 13 islands
│   │   └── util.ts
│   ├── state/store.tsx            # PIN lock/unlock, auto-lock, encrypted CRUD, backup/restore
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
│   │   └── Settings.tsx           # incl. Backup & Restore
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
   `github.com/<you>/atoll-info`.
2. In the repo, go to **Settings → Pages** and set the source to
   **GitHub Actions**.
3. Push to `main` — the included workflow
   (`.github/workflows/deploy.yml`) builds the app and deploys it
   automatically.
4. **If your repository name isn't `atoll-info`**, edit `REPO_BASE` in
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
