# Progress Log

## Current status

Project phase: active development - browser-first static prototype.

Current milestone: V2 interaction polish complete for preview/edit split behavior, slide switching persistence, selection-vs-edit-vs-drag controls, and inspector persistence safeguards.

## Latest summary

- Preview mode now renders in isolated scripted iframe (`allow-scripts`, no `allow-same-origin`) and does not attach editor click interception.
- Local image replacement is implemented for selected safe `<img>` objects.
- Edit mode keeps scripts disabled, supports select-on-click, text edit on double-click, drag threshold protection, and preserves slide edits through save/open/export.
- Slide list uses `data-label`, tracks active slide reliably, and commits pending edits before slide switch.
- Inspector includes text/alt/color/background/font/bold/geometry with geometry locking for non-absolute/fixed elements.

## Next recommended task

Run manual pilot iteration against additional complex benchmark decks for locked-element messaging and resize-handle UX refinement.

## Change log

### 2026-05-15

Date: 2026-05-15
Branch/PR: current branch / pending PR
Milestone: V2 interaction polish
Summary: Reworked V2 preview/edit behavior contracts and editor interactions: preview preserves safe self-contained interactivity, edit mode disables script actions and separates select/text-edit/drag with threshold. Added robust slide-switch commit flow and persistence checks.
Files changed: apps/desktop-v2/src/app-v2.mjs, apps/desktop-v2/index.html, scripts/test-v2.mjs, README.md, PROGRESS.md, docs/MANUAL_PILOT_GUIDE.md, docs/ROADMAP.md
Validation run: npm ci; npm run lint; npm run typecheck; npm test; npm run test:e2e; npm run test:security; npm run build; npm run test:v2; npm run package:pilot
Result: see latest run in PR report
Known limitations: Move/resize remains limited to absolute/fixed elements.
Next recommended task: optional handle-based resize UX follow-up without weakening sandbox/sanitizer rules.
