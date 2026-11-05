# Site Diagnostics Scanner

A responsive, installable (PWA) tool that runs non-intrusive checks against a site you own:

- Response header hygiene (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, cookie flags)
- TLS certificate validity, issuer, and protocol version
- A short list of commonly-exposed paths (`/.env`, `/.git/config`, etc.) checked for public access
- DNS security records (SPF, DMARC, CAA)

**Only run this against domains you own or are explicitly authorized to test.** It does not
exploit anything, brute-force logins, or scan ports — it makes the same kind of read-only
requests any browser makes when it loads a page.

## Why no separate backend / WebSocket / WASM layer

All the checks above complete in well under a second combined, so they run as a single Vercel
serverless function (`pages/api/scan.js`) with a 30s max duration. A separate FastAPI service,
WebSocket server, or C++/WASM engine would add real deployment complexity (a second host, since
Vercel functions can't hold long-lived socket connections or run raw port scans) without doing
anything the serverless function can't already do for this use case. If you later want active
scanning (open ports, live fuzzing), that genuinely needs a persistent server — happy to help you
add that as a second deployment once this is working.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo. Framework preset: Next.js (auto-detected).
3. Deploy. You'll get a URL like `https://your-project.vercel.app` — the same link works on
   phone and desktop.

## Install as an app

- **Phone (Android/iOS Chrome or Safari):** open the deployed link → browser menu → "Add to Home
  Screen" / "Install app".
- **Desktop Chrome:** click the install icon in the address bar.

## Project structure

```
pages/
  _app.js        - loads fonts, registers the service worker
  index.js        - main UI: input, results, responsive nav
  api/scan.js     - the actual checks (serverless function)
components/
  TargetInput.jsx
  CheckRow.jsx
  ResultsReport.jsx
hooks/
  useIsMobile.js
public/
  manifest.json, sw.js, icon-192.png, icon-512.png
```
