# Contributing

## Development model

Use small PRs aligned to the milestones in `MASTER_PLAN.md`.

Before coding, read:

- `AGENTS.md`
- `IMPLEMENTATION_RULES.md`
- `VALIDATION.md`
- relevant `docs/*.md`

## Pull request expectations

Each PR must include:

- Summary
- Scope
- Tests run
- Security/privacy impact
- Known limitations
- Screenshots or short screen recordings for UI changes, using synthetic data only

## Code review priorities

Review in this order:

1. Privacy/local-only behavior
2. Security boundary
3. No-admin distribution impact
4. User simplicity
5. Import/export fidelity
6. Code quality
7. Visual polish

## Test data

All test data must be synthetic.

Never commit real sensitive presentation content.
