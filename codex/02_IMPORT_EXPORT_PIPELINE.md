# Codex Task 02: Import/Export Pipeline

## Status

**Milestone 2A: COMPLETE**

**Milestone 2B: DEFERRED (requires separate explicit approval before any implementation).**

## What 2A implemented

- Local `.html` / `.htm` intake scanning is implemented in `apps/desktop/src/importer.mjs`.
- In Milestone 2A, `file.text()` is read only inside `apps/desktop/src/importer.mjs`.
- 2A only reports a scan summary rendered as `textContent` in the app shell.
- 2A does **not** render imported HTML.
- 2A does **not** inject HTML into the DOM.
- 2A does **not** execute scripts.
- 2A does **not** use iframe/webview preview.
- 2A does **not** export.
- 2A does **not** provide visual editing.
- 2A does **not** parse ZIP files.

## 2B gating and prohibitions

Milestone 2B must be approved in a separate task/PR before implementation starts.

Until that approval exists, 2B work must explicitly prohibit:

- `innerHTML`
- `outerHTML`
- `insertAdjacentHTML`
- `document.write`
- DOM injection of imported content into trusted shell context
- `DOMParser` usage for trusted-shell rendering of imported content
- iframe/webview preview
- script execution
- remote fetching
- export
- visual editing
- any Tauri/React/Vite conversion work
