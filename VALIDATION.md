# Validation

This file defines the validation contract for the project.

Exact commands may evolve once the code scaffold exists, but every task must preserve the validation categories below.

## Core command set

After the app scaffold exists, the expected commands are:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:security
npm run build
```

Packaging validation, once implemented:

```bash
npm run package:windows:user
npm run smoke:package
```

If a command does not exist yet, Codex should either create it in the relevant milestone or state clearly that it is not yet available.

## Unit tests

Unit tests should cover:

- manifest parsing
- HTML import classification
- local asset path normalization
- export serialization
- editable contract parsing
- patch application
- undo/redo state
- suspicious URL detection

## Integration tests

Integration tests should cover:

- HTML file import
- ZIP import
- image asset rewrite
- export as HTML + folder
- export as ZIP
- project reopen
- preservation of unsupported components

## End-to-end tests

E2E tests should cover:

- open project
- edit text
- replace image
- drag element
- resize element
- keyboard nudge
- undo/redo
- save/export
- reopen exported deck

## Security tests

Security tests must include malicious fixtures attempting:

- `fetch()` to a remote URL
- XHR to a remote URL
- WebSocket connection
- `navigator.sendBeacon()`
- remote image beacon
- remote script load
- local file access
- access to Tauri/Electron bridge APIs from preview content
- navigation outside the preview context

Expected result: blocked by default.

## Manual smoke test

Before release:

1. Launch packaged app as a normal user.
2. Open a simple HTML deck.
3. Edit a title.
4. Replace one image.
5. Move an image by drag.
6. Nudge it with arrow keys.
7. Export HTML.
8. Open exported HTML locally.
9. Confirm no unexpected network requests.
10. Confirm no admin prompt occurred.

## Release validation

A release cannot be considered ready unless:

- all automated tests pass
- packaged app launches
- import/export smoke test passes
- security fixtures pass
- no remote runtime assets are required
- no telemetry/cloud endpoint exists
- release notes list known limitations
