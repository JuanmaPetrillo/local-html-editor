# Release Checklist

## Pre-release

- [ ] All unit tests pass.
- [ ] All import/export tests pass.
- [ ] All E2E tests pass.
- [ ] All security fixtures pass.
- [ ] App builds successfully.
- [ ] Packaged artifact launches.
- [ ] No runtime remote dependencies.
- [ ] No telemetry or analytics.
- [ ] Release notes updated.
- [ ] Known limitations documented.

## Windows normal-user validation

- [ ] Install/run as a standard user.
- [ ] No admin prompt.
- [ ] Open local HTML.
- [ ] Open ZIP bundle.
- [ ] Edit text.
- [ ] Replace image.
- [ ] Drag/resize.
- [ ] Keyboard nudge.
- [ ] Export HTML.
- [ ] Export ZIP.
- [ ] Reopen exported deck.
- [ ] Delete/uninstall app.

## Privacy validation

- [ ] No external requests during open/edit/export.
- [ ] Remote asset warnings shown.
- [ ] Blocked network attempts visible in status/validation.
- [ ] Logs do not contain deck content.
- [ ] Export does not leak absolute paths.

## Pilot release notes must include

- what works
- what is intentionally blocked
- known unsupported HTML patterns
- how to recover original file
- where local projects are stored
- how to delete local drafts/history
