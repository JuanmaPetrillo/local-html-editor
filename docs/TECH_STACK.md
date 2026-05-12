# Technology Stack

## Current implementation (Milestones 0-2A)

Current codebase state is a static browser-first prototype:

- static HTML shell (`apps/desktop/index.html`)
- vanilla JavaScript modules (`apps/desktop/src/*.mjs`)
- Node validation/build scripts (`scripts/*.mjs`)

This is the active implementation today.
The production target stack below is deferred and not yet installed in current app code.

## Target production stack

Use Tauri 2 + React + TypeScript + Vite.

Reason:

- local desktop app
- smaller footprint than Electron
- security capabilities/permissions model
- feasible Windows user-scope installer
- web UI suitable for visual editor

## Visual editor foundation

Primary candidate: GrapesJS.

Why:

- embeddable builder framework
- drag-and-drop editing model
- established ecosystem
- supports custom component model
- can store editor project data separately from exported HTML

Important caution:

Do not treat exported HTML alone as the full source of truth. Store editor state and manifest separately.

## Drag/resize precision

Candidates:

- Moveable
- interact.js

Use these for:

- precise element movement
- resizing
- snapping
- handles
- keyboard/numeric coordination

## Import/export

Use:

- parse5 for HTML parsing/serialization
- JSZip for ZIP import/export

## Security helpers

Use:

- CSP and sandboxing as primary controls
- DOMPurify only for sanitized fragments entering the trusted UI
- synthetic malicious fixtures for regression tests

## Testing

Use:

- Vitest for unit tests
- Playwright for E2E and packaged smoke tests
- axe-core or equivalent for accessibility checks
- HTML validator for exported output where practical

## Packaging

Primary:

- Tauri Windows NSIS user-scope installer
- optional fixed WebView2 runtime if corporate machines lack WebView2 or offline install is mandatory

Fallback:

- Electron portable/user-scope package

## Avoid in MVP

- cloud backend
- database server
- user login
- telemetry
- analytics SDK
- CDN runtime dependencies
- collaborative editing
- plugin marketplace
- auto-update that calls external endpoints
