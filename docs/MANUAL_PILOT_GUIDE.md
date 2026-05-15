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

Expected output folder (V2):

- `dist/index.html`
- `dist/app-v2.bundle.js`

## 2) Create a portable pilot folder

Use the packaging helper script:

```bash
npm run package:pilot
```

Default output location:

- `pilot-dist/local-html-editor-pilot-<timestamp>/` (timestamp is Unix milliseconds from `Date.now()`)

What the script does:
- validates required `dist/` files exist
- creates a versioned output folder
- copies `dist/` recursively into that folder
- writes a small `PILOT_README.txt` with reliable launch instructions
- adds `START_HERE.bat` to run a local server on port `8765`

Optional custom destination root:

```bash
node scripts/package-pilot.mjs --out-root ./my-pilot-output
```


## 3) GitHub Actions option (manual-only)

If you prefer not to package locally, you can use the manual GitHub Actions workflow:

1. Open **Actions** in the repository.
2. Select **Build Pilot Package**.
3. Click **Run workflow**.
4. Wait for the run to complete.
5. Open the run summary and download the artifact named `local-html-editor-pilot`.

Artifact retention is 7 days.

Because this repository is public, standard GitHub-hosted runner usage is free. The workflow is manual-only to avoid waste.

Local fallback is still available:

```bash
npm run package:pilot
```

## 4) Optional zip step (manual)

If pilot users prefer one file, zip the created portable folder manually using built-in OS tools or approved internal tooling.

Important:
- Zipping is a transport convenience only.
- The app remains browser-first (`index.html` + local modules).
- No installer/executable is produced by this process.

## 5) Pilot user instructions

1. Extract/copy the pilot folder to any user-writable location.
2. Double-click `START_HERE.bat` (recommended).
3. If the browser does not open automatically, open `http://localhost:8765`.
4. Use **Open HTML/ZIP** and select a local `.html` or `.htm` file.

Why this is recommended:
- Some browser/corporate policies block ES module loading from `file://` URLs.
- This app relies on `src/app-shell.mjs`; if that module is blocked, file selection UI may appear but upload handling will not run.

## 6) Manual pilot checklist

Run this checklist with at least one synthetic fixture deck (e.g. `tests/fixtures/v2-overlay-interaction.html`):

1. Open app through `START_HERE.bat` (`http://localhost:8765`).
2. Open HTML file — slide list should populate.
3. **Hover** over elements — dashed hover box should follow cursor.
4. **Click** a button — selection box appears, button does NOT activate.
5. **Click** a heading — selection box moves to heading, inspector populates.
6. **Double-click** a heading — cursor appears, type text, press Enter — text updates.
7. **Escape** during text edit — text reverts, no extra undo entry.
8. **Ctrl+Click** a link — follows the link without selecting a new element.
9. **Drag** an absolute-positioned element — moves smoothly, selection box tracks.
10. **Drag a resize handle** (corner or edge) — element resizes, selection box tracks.
11. **Click a normal-flow element then drag** — element is converted to absolute positioning automatically; status bar shows conversion notice. Press Ctrl+Z to undo if surrounding layout shifts unexpectedly.
12. **Inspector X/Y/W/H fields** — update live on positioned element.
13. **Undo** after drag/resize — position/size reverts.
14. **Switch to Preview** — full presentation renders, buttons and scripts work.
15. **Switch back to Edit** — selection cleared, overlay active again.
16. **Save project** (`.lheproj-v2.json`) — open JSON, confirm no `originalHtml` key.
17. **Export HTML** — open in browser, text/style changes visible, no scripts.
18. ZIP preflight-only behavior: open `.zip` and confirm preflight status/warnings appear and extraction/listing remains unavailable in this build.

## 7) Current known limitations (pilot)

- ZIP remains preflight-only (no extraction/listing/export).
- No autosave/localStorage/IndexedDB.
- No installer/executable packaging in this milestone.
- Browser security policies may vary by enterprise-managed browser configuration.

## V2 pilot usage (updated)
Use `npm run build` then `npm run package:pilot`. Package now includes standalone `index.html` + `app-v2.bundle.js` and `START_HERE.bat`.

Updated V2 pilot behavior: slide navigator + inspector/layers + project save/open (`lheproj-v2`) + export all slides.

V2 support contract in this pilot:
- Visual fidelity first: render sanitized original DOM/CSS in iframe (best effort).
- Safe direct editing second: inline text edits and simple add/delete operations on safe elements.
- Locked/preserved third: script-driven/remote/unsafe components are sanitized or non-interactive in edit/export mode.

Known V2 limitation: generalized move/resize overlay editing for arbitrary imported elements is not complete yet.


## Preview vs Edit checklist (V2)

Preview mode checks:
- Buttons/interactions that are self-contained in HTML inline/local script should run in preview iframe.
- Arrow-key navigation works when preview iframe has focus and source defines keyboard handlers.
- Remote resources remain blocked/sanitized.

Edit mode checks:
- Click selects without moving.
- Double-click enters text edit and typing does not drag object.
- Buttons are selectable/editable but do not execute original onclick actions.
- Slide sidebar changes visible slide and preserves edits when switching away/back.
- Move/resize works for all elements; dragging or nudging a normal-flow element converts it to absolute positioning automatically (Ctrl+Z to undo if layout changes unexpectedly).
