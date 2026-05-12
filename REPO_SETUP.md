# Repository Setup

## Recommended GitHub repo

Name:

```text
local-html-presentation-editor
```

Visibility:

```text
Private
```

Description:

```text
Fully local no-code editor for Copilot-generated interactive HTML presentations.
```

## Create the repo manually in GitHub

1. Go to GitHub.
2. Create a new private repository.
3. Use the recommended name above.
4. Do not add sample code yet.
5. Upload this Markdown scaffold.
6. Open the repo in Codex.
7. Run the prompt in `codex/00_BOOTSTRAP_REPO.md`.

## Why manual repo creation may be needed

Some connected GitHub tools can edit existing repositories but cannot create brand-new repositories. This scaffold is designed to be uploaded as the first commit.

## Local development on a no-admin PC

Do not depend on local admin rights.

Recommended development path:

- Use GitHub web for repository management.
- Use Codex Cloud for code generation and PRs.
- Use GitHub Actions for builds and packaging.
- Download packaged artifacts for testing.
- Avoid requiring Rust, MSVC, Node installers, or admin-level tools on the work PC.

## First Codex prompt

```text
Read AGENTS.md, README.md, MASTER_PLAN.md, IMPLEMENTATION_RULES.md, VALIDATION.md, and docs/ARCHITECTURE.md.

Then execute codex/00_BOOTSTRAP_REPO.md exactly.

Create a narrow PR for Milestone 0 only.
Do not implement editor features yet.
Do not add telemetry, cloud sync, or any runtime network dependency.
Update PROGRESS.md before finishing.
```
