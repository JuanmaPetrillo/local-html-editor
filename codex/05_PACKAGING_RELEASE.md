# Codex Task 05: Packaging and Release

## Goal

Create packaging workflow for normal-user distribution.

## Read first

- `docs/NON_ADMIN_DISTRIBUTION.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/QUALITY_GATES.md`

## Scope

Allowed:

- GitHub Actions packaging workflow
- Windows user-scope installer or portable package
- smoke test script
- release artifact naming
- packaging docs
- optional fixed WebView2 decision record

Not allowed:

- no auto-updater that calls external endpoints
- no admin-required installer as the only artifact
- no telemetry/crash reporting
- no package that depends on runtime CDN assets

## Done when

- package artifact can be built in CI
- release artifact is documented
- normal-user install/run smoke test is defined
- no-admin constraint is preserved
- `PROGRESS.md` is updated
