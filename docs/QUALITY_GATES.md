# Quality Gates

## Merge gate

A PR can merge only when:

- scope matches the task
- tests pass or exceptions are explicitly approved
- security invariants are preserved
- no real sensitive files are committed
- `PROGRESS.md` is updated
- PR body documents validation

## Security gate

Any PR touching preview, import, export, filesystem, packaging, or dependencies must answer:

- Can imported HTML access app APIs?
- Can imported HTML make network calls?
- Can imported HTML read/write files?
- Are remote assets blocked or warned?
- Are local absolute paths avoided in export?
- Does this add any cloud/telemetry behavior?

## UX gate

Any user-facing feature must be evaluated against:

- Can a non-technical user understand it?
- Is the action reversible?
- Is there a plain-language error message?
- Is keyboard access available where dragging is used?
- Does the UI avoid exposing unnecessary code concepts?

## Import/export gate

Any import/export change must prove:

- original source preserved
- local assets found
- missing assets reported
- remote references detected
- export opens locally
- no absolute local paths leaked

## Packaging gate

Any release/package change must prove:

- no admin requirement for normal users
- offline launch after download
- no runtime CDN dependency
- no telemetry/cloud call
- uninstall/delete path is clear
