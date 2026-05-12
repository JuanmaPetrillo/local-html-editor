# Codex Task 01: Foundation Shell

## Status

**COMPLETE**

## Goal

Create the first runnable local desktop app shell.

## Scope

Allowed:

- Tauri + React + TypeScript + Vite app shell
- basic app layout
- local open-file dialog
- local save/export placeholder
- project manager placeholder
- synthetic fixture open smoke test

Not allowed:

- no real editor features yet
- no broad filesystem access
- no script-enabled preview
- no cloud/telemetry/CDN

## UX target

The app should launch to a simple screen with:

- Open HTML/ZIP
- Recent projects placeholder
- Safe/local privacy note
- Empty canvas state

## Done when

- app launches in development/CI environment
- selecting an HTML file reads it through a safe trusted pathway
- source file is not overwritten
- imported content is not executed
- tests/smoke checks pass
- `PROGRESS.md` is updated
