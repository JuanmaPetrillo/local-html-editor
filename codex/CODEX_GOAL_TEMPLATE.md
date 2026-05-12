# Codex CLI Goal Template

Use only when running Codex CLI with `/goal` and the task has a clear stopping condition.

```text
/goal [durable objective]

Context files to read first:
- AGENTS.md
- MASTER_PLAN.md
- IMPLEMENTATION_RULES.md
- VALIDATION.md
- PROGRESS.md
- docs/[relevant].md

Stop only when:
- [testable end state]
- [validation commands pass]
- PROGRESS.md is updated

Constraints:
- Do not expand beyond [specific milestone].
- Do not weaken security sandboxing, CSP, network blocking, or filesystem scope.
- Do not add telemetry, cloud sync, remote AI calls, analytics, or CDNs.
- Use synthetic fixtures only.
- Keep changes reviewable.
```

Prefer PR-sized Codex Cloud tasks unless the CLI goal mode is available and appropriate.
