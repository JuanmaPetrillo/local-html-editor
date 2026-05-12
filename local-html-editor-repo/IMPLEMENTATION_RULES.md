# Implementation Rules

## Development strategy

Use documentation-first, milestone-based development.

The large product goal lives in the repository. Codex tasks should be small, specific, and validated by tests.

## How Codex should work

For every task:

1. Read `AGENTS.md`.
2. Read the relevant milestone in `MASTER_PLAN.md`.
3. Read `VALIDATION.md`.
4. Read any relevant `docs/*.md` file.
5. Make the smallest safe change.
6. Run relevant validations.
7. Update `PROGRESS.md`.
8. Create a PR with a complete summary.

## Branch naming

Use branch names like:

```text
codex/m0-repo-foundation
codex/m1-desktop-shell
codex/m2-import-export
codex/m3-editor-mvp
codex/m4-secure-preview
codex/m5-packaging
```

## PR size rule

A good PR should usually change one feature slice.

Acceptable examples:

- Add local file picker and project creation.
- Add ZIP import fixture tests.
- Add keyboard nudging for selected elements.
- Add CSP network-blocking regression test.

Bad examples:

- Build the entire app.
- Replace the editor architecture and add packaging in one PR.
- Add new UI framework plus editor MVP plus tests.

## Dependency rule

Before adding a runtime dependency, document:

- Why it is needed.
- Whether it runs locally.
- Whether it makes network calls.
- License.
- Alternative considered.

Do not add dependencies from CDNs.

## Security rule

Never weaken any of the following without explicit human approval:

- preview sandbox
- CSP
- filesystem permission scope
- network blocking
- script-disabled design mode
- no-telemetry/no-cloud behavior

## Fixture rule

All fixtures must be synthetic. Do not commit real corporate data or real sensitive presentations.

Fixture categories:

- simple single-file deck
- deck with local image folder
- deck with CSS transforms
- deck with simple JS interaction
- deck with remote URL references
- malicious deck attempting network calls
- malicious deck attempting local file access

## Progress tracking

Update `PROGRESS.md` after every PR with:

- date
- branch/PR
- milestone
- what changed
- validations run
- known risks
- next recommended task

## When blocked

Do not guess around important product/security decisions.

If blocked, write the blocker in `PROGRESS.md` and PR description using this format:

```text
Blocked decision:
Options considered:
Recommended option:
Risk if guessed:
```
