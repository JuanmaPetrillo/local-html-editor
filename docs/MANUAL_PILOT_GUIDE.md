# Manual Pilot Packaging Guide (Browser-first MVP)

This guide defines a **no-admin, manual pilot distribution process** for the current browser-first app.

Scope of this guide:
- Build `dist/` locally.
- Package/copy `dist/` into a versioned portable folder for pilot sharing.
- Optionally zip that portable folder using OS tooling.
- Run a manual pilot checklist.

Out of scope:
- No installer creation.
- No executable packaging.
- No framework conversion (no Electron/Tauri changes).

## 1) Build output

From repository root:

```bash
npm ci
npm run build
```

Expected output folder:

- `dist/index.html`
- `dist/src/app-shell.mjs`
- supporting `dist/src/*.mjs` runtime modules copied by build

## 2) Create a portable pilot folder

Use the packaging helper script:

```bash
npm run package:pilot
```

Default output location:

- `pilot-dist/local-html-editor-pilot-v<version>-<YYYYMMDD-HHMMSS>/`

What the script does:
- validates required `dist/` files exist
- creates a versioned output folder
- copies `dist/` recursively into that folder
- writes a small `PILOT_README.txt` with open instructions

Optional custom destination root:

```bash
node scripts/package-pilot.mjs --out-root ./my-pilot-output
```

## 3) Optional zip step (manual)

If pilot users prefer one file, zip the created portable folder manually using built-in OS tools or approved internal tooling.

Important:
- Zipping is a transport convenience only.
- The app remains browser-first (`index.html` + local modules).
- No installer/executable is produced by this process.

## 4) Pilot user instructions

1. Extract/copy the pilot folder to any user-writable location.
2. Open `index.html` in a local browser.
3. Use **Open HTML/ZIP** and select a local `.html` or `.htm` file.

## 5) Manual pilot checklist

Run this checklist with at least one synthetic fixture deck:

1. Open app (`index.html`) from portable folder.
2. Open HTML file.
3. Edit text and apply draft to preview.
4. Move one supported object.
5. Drag and resize one supported object.
6. Replace one image with a local file.
7. Save project (`.lheproj.json`).
8. Reopen project and verify patches restore.
9. Export edited HTML.
10. Open exported HTML locally and verify expected edits.
11. Reset and verify preview returns to imported original.
12. ZIP preflight-only behavior: open `.zip` and confirm preflight status/warnings appear and extraction/listing remains unavailable in this build.

## 6) Current known limitations (pilot)

- ZIP remains preflight-only (no extraction/listing/export).
- No autosave/localStorage/IndexedDB.
- No installer/executable packaging in this milestone.
- Browser security policies may vary by enterprise-managed browser configuration.
