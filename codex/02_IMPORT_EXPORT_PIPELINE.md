# Codex Task 02: Import/Export Pipeline

## Goal

Implement the initial local import/export pipeline for HTML and ZIP files.

## Read first

- `docs/IMPORT_EXPORT_SPEC.md`
- `docs/EDITABLE_CONTRACT.md`
- `docs/SECURITY_MODEL.md`
- `VALIDATION.md`

## Scope

Allowed:

- parse HTML
- import ZIP
- identify entry HTML file
- copy/localize assets into project structure
- detect remote references
- generate manifest
- export HTML + assets
- export ZIP
- add roundtrip tests

Not allowed:

- no visual editing UI unless needed for smoke testing
- no executing imported JS during import
- no remote fetching of assets in MVP
- no destructive rewrite without preserving original source

## Done when

- synthetic HTML fixture imports
- synthetic ZIP fixture imports
- remote reference fixture reports warnings
- export opens locally
- original source remains preserved
- tests pass
- `PROGRESS.md` is updated
