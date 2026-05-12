# Local HTML Presentation Editor

A fully local editor initiative for Copilot-generated HTML presentations.

## Current implementation state

This repository is now in active development as a **browser-first static prototype**.

- Milestone 0 is complete.
- Milestone 1 is complete (static shell).
- Milestone 2A is complete (local `.html/.htm` text scan only).

Current app files:

- `apps/desktop/index.html`
- `apps/desktop/src/app-shell.mjs`
- `apps/desktop/src/importer.mjs`

## Current capabilities

- Local file selection from the browser shell.
- Non-destructive local project metadata state.
- Local `.html/.htm` intake scanning via `importer.mjs`.
- Scan summary output via safe `textContent` UI updates.
- Local validation scripts and CI workflow file present.

## Current non-capabilities

- No ZIP parsing.
- No rendering/preview iframe/webview.
- No script execution from imported content.
- No export.
- No visual editing.
- No Tauri/React/Vite/TypeScript app code installed yet.

## Next step

Complete documentation cleanup sync first, then proceed only with separately approved Milestone 2B scope.
