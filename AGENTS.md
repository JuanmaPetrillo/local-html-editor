# AGENTS.md

This file contains permanent instructions for Codex and any other coding agent working in this repository.

## Role of this repo

Build a fully local, no-admin-friendly desktop app that lets non-technical users make simple visual edits to sensitive Copilot-generated HTML presentations without sending the content to any third party.

## Non-negotiable invariants

### Privacy and locality

- The app must not upload presentation HTML, assets, drafts, logs, screenshots, or metadata to any third-party service.
- Do not add telemetry, analytics, crash reporting, cloud sync, remote AI calls, or external API calls.
- Do not add CDN dependencies in runtime HTML. Runtime assets must be bundled locally.
- Any remote URL detected in imported content must be flagged to the user and blocked by default in safe mode.

### Security boundary

- Treat imported HTML as untrusted content.
- Imported content must never run in the same privileged context that owns filesystem access, dialogs, or app commands.
- Design mode must default to script execution disabled.
- Interactive preview, when implemented, must run in an isolated webview/session with no app bridge and no remote network access by default.
- Never expose broad filesystem permissions to preview content.
- Never weaken sandbox, CSP, or permission settings to make a test pass.

### User and distribution constraints

- End users are non-technical.
- End users may not have administrator rights.
- The primary target is managed corporate Windows PCs.
- Development may happen through GitHub + Codex + CI, not necessarily on the user's local PC.
- The app should eventually be distributable as a normal-user Windows installer or portable package.

### Product scope

- The app is not a general-purpose website builder.
- The app is for micro-edits: text, images, positions, sizes, simple styling, and export.
- Complex redesigns should remain in the Copilot Chat workflow or be handled by technical users.
- Preserve unsupported components rather than destructively rewriting them.

## Engineering rules

- Prefer the simplest implementation that satisfies the requirement safely.
- Keep PRs small and reviewable.
- Do not perform sweeping refactors unless explicitly requested in the current task.
- Use TypeScript strict mode once the app scaffold exists.
- Add or update tests with every functional change.
- Keep dependencies minimal and justify every new runtime dependency in the PR body.
- Prefer local open-source libraries with permissive licenses for app runtime dependencies.
- Do not commit secrets, corporate data, real sensitive presentations, tokens, or internal screenshots.
- Use synthetic fixtures only.

## Required repo reading order

Before editing, read:

1. `README.md`
2. `MASTER_PLAN.md`
3. `IMPLEMENTATION_RULES.md`
4. `VALIDATION.md`
5. `docs/SECURITY_MODEL.md`
6. Relevant milestone prompt in `codex/`

## Required output for every Codex PR

Every PR must include:

- What changed
- Why it changed
- Files modified
- Tests run
- Security/privacy impact
- Known limitations
- Whether `PROGRESS.md` was updated

## Definition of done

A task is done only when:

- The requested scope is complete.
- Existing behavior is preserved unless the task explicitly changed it.
- Validation commands pass or failures are documented with exact reason.
- Security invariants remain intact.
- `PROGRESS.md` is updated.
- The PR is narrow enough for human review.
