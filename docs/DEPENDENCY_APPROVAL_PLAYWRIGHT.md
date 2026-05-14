# Dependency Approval Request: `@playwright/test` for Browser-Driven E2E

## Why this request exists

Packaging/pilot readiness requires at least one true browser runtime smoke test for the current browser-first local HTML editor. Current `test:e2e` checks are primarily static/string-level checks and do not execute the app in a real browser runtime.

## Requested dependency

- Package: `@playwright/test`
- Scope: dev-only (test tooling)
- Runtime impact: none (not bundled into app runtime)

## What was attempted

Command attempted in this environment:

```bash
npm install @playwright/test --no-save --package-lock=false
```

Result:

- `npm ERR! code E403`
- `403 Forbidden - GET https://registry.npmjs.org/@playwright%2ftest`

This indicates registry/security policy access is currently blocked.

## Proposed use once approved

Add one minimal browser smoke test that:

1. Opens built app (`dist/index.html`) in a browser runtime.
2. Uploads a realistic HTML fixture through file input automation.
3. Verifies safe preview status transitions from unavailable to available.
4. Verifies primary controls are present (selected text edit, move/resize, image replacement, save project, export).
5. Applies a text edit and confirms export button enablement.
6. Verifies Advanced details are collapsed by default.
7. Verifies ZIP messaging remains preflight/listing-unavailable (no extraction implied).

## Security and scope constraints (unchanged)

- No iframe internals access (`contentDocument` / `contentWindow`).
- No `postMessage` bridge.
- No iframe permission/sandbox changes.
- No network calls or telemetry.
- No autosave/localStorage/IndexedDB.
- No packaging work in this slice.
- No ZIP/assets feature implementation in this slice.

## If approval is denied

Remain on the existing static + fixture-driven checks and use the manual pilot checklist for browser runtime verification until approved browser automation tooling becomes available.
