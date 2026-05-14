# Dependency approval request: JSZip (Phase 7B)

## Request

Approve use of `jszip` from npm (or provide an approved internal mirror/package source) for `local-html-editor`.

## Context

This app is a browser-first, local-only HTML presentation editor. Current implemented scope includes:

- single HTML editing,
- text/layout/image patches,
- local HTML export,
- ZIP preflight/path-safety scaffolding only.

## Why JSZip is needed

Phase 7B requires safe ZIP:

- entry listing,
- selected main-HTML extraction,
- asset preservation, and
- ZIP re-export.

Hand-rolling ZIP parsing/writing is higher-risk and not appropriate for this security-sensitive editor. `jszip` is the smallest practical dependency for browser-side ZIP read/write in this project.

## Current blocker

Command attempted:

```bash
npm install jszip --no-save --package-lock=false
```

Current result:

```text
E403 Forbidden - GET https://registry.npmjs.org/jszip
```

## Security constraints that remain unchanged

If approved, implementation will keep current invariants:

- No network calls from app runtime.
- No telemetry.
- No script execution from ZIP content.
- No iframe permission changes.
- No filesystem writes from ZIP paths.
- ZIP paths normalized and blocked on traversal, absolute paths, drive paths, control characters, and duplicate normalized paths.
- Preview remains sandboxed and script-disabled.
- Export remains local-only via browser download.

## Fallback if approval is denied

If `jszip` cannot be approved, ZIP support should remain paused at preflight/path-safety only. ZIP parsing/writing will not be implemented manually.
