# Codex Task 04: Secure Preview

## Goal

Implement safe design mode and isolated interactive preview behavior.

## Read first

- `docs/SECURITY_MODEL.md`
- `docs/THREAT_MODEL.md`
- `VALIDATION.md`

## Scope

Allowed:

- script-disabled design preview
- sandboxed preview container
- CSP/network-blocking policy
- isolated interactive preview mode
- blocked request reporting
- malicious fixtures
- security tests

Not allowed:

- no broad filesystem permissions
- no app bridge in preview
- no external network allowlist unless explicitly approved
- no weakening design mode

## Required malicious fixtures

Add tests for:

- fetch
- XHR
- WebSocket
- sendBeacon
- remote image beacon
- remote script
- top navigation
- app bridge access
- local file access attempt

## Done when

- malicious fixtures are blocked in safe mode
- preview cannot call app APIs
- blocked attempts are visible to user or test logs
- `PROGRESS.md` is updated
