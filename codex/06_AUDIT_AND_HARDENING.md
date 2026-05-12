# Codex Task 06: Audit and Hardening

## Goal

Audit the app against the product, security, UX, and packaging requirements.

## Read first

- all root `.md` files
- all `docs/*.md` files
- latest `PROGRESS.md`

## Scope

Allowed:

- identify gaps
- add missing tests
- improve validation scripts
- fix small bugs
- update documentation
- create issues for larger work

Not allowed:

- no broad rewrite
- no architecture change without decision record
- no weakening security defaults

## Audit checklist

- Full local behavior
- No remote runtime dependencies
- No telemetry
- Preview isolation
- Import/export fidelity
- Non-admin packaging
- No-code UX
- Accessibility alternatives for dragging
- Synthetic fixture coverage
- CI validation

## Done when

- audit report is added to `PROGRESS.md` or `docs/QUALITY_GATES.md`
- actionable gaps are filed or documented
- high-risk bugs found during audit are fixed or clearly blocked
- validation status is recorded
