# Codebase Audit and Refactor Plan (2026-05-17)

## Scope and method

This audit covers the full current repository with focus on the active implementation path (`apps/desktop-v2/`) and security/locality requirements in root policy docs.

Primary review inputs:

- Product and architecture baseline (`README.md`, `MASTER_PLAN.md`)
- Engineering and validation constraints (`IMPLEMENTATION_RULES.md`, `VALIDATION.md`)
- Security model (`docs/SECURITY_MODEL.md`)
- Current implementation hotspots (`apps/desktop-v2/src/app-v2.mjs`)
- Existing progress log (`PROGRESS.md`)

## Executive summary

The repository is aligned with the documented privacy-first direction, and the active validation scripts currently pass. The largest technical risk is **maintainability concentration** in a single large V2 implementation file. The codebase is ready for **incremental hardening refactors** rather than a broad rewrite.

Recommended strategy: run a short series of narrow refactor PRs that preserve behavior while improving testability and security confidence.

## Strengths observed

1. **Security/locality posture is explicit and consistent in docs**:
   - clear untrusted-content model
   - no-cloud/no-telemetry constraints
   - sandboxed preview concepts
2. **Validation contract exists and is runnable** from repo root.
3. **Pragmatic MVP scope** is documented, including explicit non-goals and known limits.
4. **Progress tracking discipline** exists via `PROGRESS.md` and milestone docs.

## Audit findings and refactor opportunities

### A. Architecture and maintainability

1. **Monolithic app module (high priority)**
   - `apps/desktop-v2/src/app-v2.mjs` currently centralizes UI state, DOM interaction, selection logic, edit commands, and export wiring.
   - Impact: higher regression risk for any change, harder targeted testing, slower onboarding.
   - Refactor direction: split by behavior-preserving seams first:
     - selection/overlay engine
     - command/state history (undo/redo)
     - sanitizer/import/export adapters
     - inspector field bindings

2. **Implicit contracts between UI and state**
   - Several operations appear coupled through shared mutable state rather than narrow interfaces.
   - Impact: hidden dependencies; harder to test edge cases in isolation.
   - Refactor direction: define small pure helpers for transformation logic and keep DOM plumbing thin.

### B. Test quality and verification depth

3. **Validation scripts include placeholders**
   - current script outputs indicate placeholder checks for typecheck/e2e in places.
   - Impact: passing gate may overstate confidence for regressions.
   - Refactor direction:
     - add focused unit tests around high-risk helpers before extracting modules
     - add one real regression fixture per major editor action (text edit, drag, resize, export sanitize)

4. **Insufficient explicit regression guards for risky edits**
   - Undo/redo, absolute-position conversion, and sanitization boundaries should have dedicated edge-case fixtures.
   - Impact: subtle behavior drift during refactor.

### C. Security/privacy hardening

5. **Need automated assertions for security invariants in V2 path**
   - Docs are strong, but enforcement should be continuously checked in tests.
   - Refactor direction:
     - assert no remote URL survival in sanitized edit/export output when policy requires blocking
     - assert iframe sandbox attributes in rendered UI
     - assert inline handlers/scripts stripped in edit/export mode

6. **Policy-to-code traceability can improve**
   - Security model is detailed; mapping each requirement to concrete tests/files would reduce audit time.
   - Refactor direction: add a “security control matrix” markdown table linking invariant → implementation location → test.

### D. Product expansion readiness

7. **ZIP path remains preflight-only (known limitation)**
   - Clear in docs; expansion opportunity is staged ZIP roundtrip support with strict local-only policy.

8. **Persistence limitations (known limitation)**
   - No autosave/local storage by design today.
   - Expansion path: explicit user-driven save/open workflows with deterministic format versioning.

9. **Packaging readiness gap**
   - Browser-first pilot path works; non-admin Windows installer path remains future milestone.

## Prioritized refactor roadmap (small PR sequence)

1. **PR 1: Extract pure edit-command helpers (no UI behavior change)**
   - Goal: isolate deterministic transforms and add unit coverage.
2. **PR 2: Extract overlay/selection math module**
   - Goal: reduce canvas interaction coupling and test geometry math.
3. **PR 3: Security regression suite uplift**
   - Goal: convert policy invariants into executable checks.
4. **PR 4: Export pipeline contract tests**
   - Goal: ensure sanitize/export outputs remain stable across refactors.
5. **PR 5: Documentation traceability pass**
   - Goal: add security control matrix and test mapping table.

## Areas for improvement and expansion

- Increase unit coverage for pure logic before structural refactors.
- Introduce fixture-backed regression tests for representative arbitrary HTML variants.
- Define strict module boundaries in V2 (state core vs DOM adapters vs IO adapters).
- Add a security control matrix for maintainable audits.
- Plan ZIP roundtrip milestone with explicit threat-model checks.
- Plan packaging milestone with user-scope installer validation checklist.

## Risks if attempting a “full-codebase refactor” in one pass

- Breaks small-PR rule and reviewability goals.
- Raises security regression probability in untrusted-content boundaries.
- Increases rollback complexity for pilot users.

## Recommended delivery approach

Treat this audit as the baseline and execute refactors in narrow, behavior-preserving PR slices with tests added in the same PR as each extraction.
