# Architecture

## Architecture goal

Build a local desktop app with a trusted shell and an isolated untrusted preview/editing surface.

The app must let users edit HTML decks visually without allowing imported HTML to access privileged app APIs.

## High-level components

```text
Desktop shell
  ├─ Trusted app shell
  │   ├─ file open/save dialogs
  │   ├─ project manager
  │   ├─ importer/exporter orchestration
  │   ├─ validation engine
  │   └─ release/update-free local runtime
  │
  ├─ Editor UI
  │   ├─ canvas
  │   ├─ layer panel
  │   ├─ asset panel
  │   ├─ inspector
  │   ├─ toolbar
  │   └─ history/undo-redo
  │
  ├─ Import/export packages
  │   ├─ HTML parser
  │   ├─ asset resolver
  │   ├─ manifest builder
  │   ├─ ZIP reader/writer
  │   └─ exporter
  │
  └─ Preview sandbox
      ├─ design mode: scripts disabled
      └─ interactive mode: isolated, no app bridge, network denied by default
```

## Trust boundaries

### Trusted

- Tauri/Electron main process
- file dialogs
- filesystem write operations
- project manifest
- export pipeline
- app settings

### Semi-trusted

- editor UI state
- synthetic test fixtures
- local user-selected files after import classification

### Untrusted

- imported HTML
- imported CSS
- imported JS
- imported SVG scripts/events
- imported external URLs
- pasted HTML fragments

## Default runtime model

Use two preview modes:

### Design mode

- Default mode.
- Scripts disabled.
- Remote network blocked.
- User can select/edit/move/resize elements.
- Used for normal no-code editing.

### Interactive preview mode

- Explicit user action.
- Separate isolated preview surface.
- No app bridge.
- No filesystem access.
- No remote network by default.
- Used only to check interactions.

## Internal project format

```text
project-name/
  manifest.json
  source/
    original.html
  assets/
    ...
  editor-state.json
  revisions/
    2026-05-11T120000Z.json
  export/
    latest.html
```

## Data flow

```text
Copilot HTML/ZIP
  -> import classifier
  -> asset normalization
  -> manifest generation
  -> editor state creation
  -> design mode canvas
  -> patches/history
  -> validation
  -> export HTML/ZIP
```

## Package layout target

```text
apps/
  desktop/
packages/
  editor-core/
  importer/
  exporter/
  preview-sandbox/
  shared/
tests/
  fixtures/
  e2e/
  security/
```

## Key technical decisions

- Do not rely on `file://` paths for app runtime unless explicitly safe.
- Do not let preview content call app APIs.
- Do not use remote CDNs.
- Do not use cloud storage.
- Keep project state separate from exported HTML.
- Use synthetic fixtures only.
