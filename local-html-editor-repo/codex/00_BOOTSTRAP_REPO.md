# Codex Task 00: Bootstrap Repository

## Goal

Create the initial code repository scaffold without implementing editor features yet.

## Read first

- `AGENTS.md`
- `README.md`
- `MASTER_PLAN.md`
- `IMPLEMENTATION_RULES.md`
- `VALIDATION.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
- `docs/NON_ADMIN_DISTRIBUTION.md`

## Scope

Allowed:

- create package/app folder structure
- create package manager config
- create TypeScript/Vite/Tauri placeholders if feasible
- create CI placeholder
- create synthetic fixture folders
- create basic validation scripts
- update `PROGRESS.md`

Not allowed:

- no visual editor features
- no import/export implementation
- no real corporate data
- no telemetry
- no cloud service
- no CDN runtime dependency

## Expected structure

```text
apps/desktop/
packages/editor-core/
packages/importer/
packages/exporter/
packages/preview-sandbox/
packages/shared/
tests/fixtures/
tests/e2e/
tests/security/
.github/workflows/
```

## Done when

- repository has a clear app/package structure
- basic scripts exist for lint/typecheck/test/build, even if some are placeholders
- synthetic fixture README exists
- CI workflow exists or a clear TODO is documented if blocked
- `PROGRESS.md` is updated
- PR summary explains what was scaffolded and what was intentionally not implemented
