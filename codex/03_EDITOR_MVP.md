# Codex Task 03: Editor MVP

## Goal

Implement the first usable no-code visual editing flow.

## Read first

- `docs/UX_PRINCIPLES.md`
- `docs/EDITABLE_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`

## Scope

Allowed:

- element selection
- text editing
- image replacement
- drag/resize
- snap/grid basics
- keyboard nudging
- numeric inspector
- undo/redo
- export edited result

Not allowed:

- no arbitrary JS editor
- no cloud AI helper
- no collaboration
- no complex template library
- no unsafe preview changes

## Required behavior

- Arrow keys move selected element by 1px.
- Shift+Arrow moves selected element by 10px.
- Image replacement uses local files only.
- Text editing preserves basic inline formatting where feasible.
- Undo/redo covers text, image, move, resize.

## Done when

- non-technical edit flow works on synthetic fixture
- E2E test covers open/edit/export/reopen
- undo/redo tested
- accessibility alternatives exist for drag actions
- `PROGRESS.md` is updated
