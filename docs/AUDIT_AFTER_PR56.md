# Audit After PR #56 — Post-Merge Hardening

**Date:** 2026-05-15
**Branch:** `claude/audit-pr56-hardening-0f2l2`
**Audited state:** HEAD `16593ca` (Merge PR #56 — V2 interaction polish)

---

## 1. Executive Verdict

V2 is functionally ready for internal manual pilot sharing with trusted colleagues. The core product contract — open an HTML presentation, visually preview it, make micro-edits, export safe HTML — works correctly. PR #56 delivered the click-select/double-click-edit/drag-threshold/inspector/slide-nav behavior as described.

This audit found **no blocking regressions** and **five safe fixes** that improve robustness before wider sharing:

- SVG images added via the "Add Image" button were not MIME-validated, meaning a non-PNG file could be embedded (now blocked at both the button level and the sanitizer level).
- Project save files contained the full original HTML (including the original scripts/styles from the source file), which was unused on restore and bloated the file (now only the sanitized edited HTML is stored).
- `<meta http-equiv="refresh">` in the source HTML was not stripped in edit mode, which could navigate the edit iframe away (now stripped).
- Pressing Escape to cancel a text edit added a spurious entry to the undo stack, making the undo button available for a no-op (now guarded).
- `lint.mjs`, `typecheck.mjs`, and `test-security.mjs` only validated legacy V1 code; V2 had minimal automated contract coverage (now added).

---

## 2. Validation Results

All gates pass before and after changes:

```
npm run lint          ✅
npm run typecheck     ✅
npm test              ✅
npm run test:e2e      ✅
npm run test:security ✅
npm run build         ✅
npm run test:v2       ✅
npm run package:pilot ✅
```

Baseline HEAD: `16593ca` — all 8 gates already passing.
Post-fix HEAD: all 8 gates still passing.

---

## 3. Findings by Severity

### P0 — Fix before next pilot build

**P0-1: SVG data URIs bypass sanitizer via "Add Image" button**
- File: `apps/desktop-v2/src/app-v2.mjs`
- Root cause: `addImageBtn.onclick` uses a FileReader to get a data URL and injects it directly into the edit frame without validating the MIME type. The HTML `accept` attribute is advisory only — a user can select any file. `blockRemoteAttributes` blocked `https:` and `//` URLs but not `data:image/svg+xml`. SVG can contain embedded scripts that run in preview mode (`sandbox="allow-scripts"`). The SVG also survives `exportModelToHtml`.
- Fix: (a) MIME validation in `addImageBtn.onclick` before insertion; (b) `isBlockedDataUrl` helper added to `blockRemoteAttributes` that drops `data:image/svg+xml` and `data:text/` URIs.
- Regression guard: `test-v2.mjs` — asserts SVG data URI stripped by `stripUnsafeHtml`, PNG data URI preserved; asserts `data:text/` stripped.
- **Status: Fixed.**

### P1 — Fix before sharing pilot broadly

**P1-1: createProjectPayload leaks originalHtml**
- File: `apps/desktop-v2/src/app-v2.mjs`
- Root cause: `createProjectPayload` used `{ ...model, ... }` which spread ALL model fields including `originalHtml` (the raw source HTML as loaded from the file, before any sanitization). The `IMPORT_EXPORT_SPEC.md` specifies "Do NOT persist raw original HTML". The field is never read back — `restoreProjectPayload` only uses `model.sourceHtml` and re-sanitizes. The spread also included `previewHtml` (live-preview HTML with scripts but without remote URLs), which is also regenerated on restore. Both fields were dead weight that bloated the project file.
- Fix: Replace `{ ...model, sourceHtml: ..., previewHtml: ... }` with explicit field selection: `{ sourceHtml, slides, selectedSlideId, mode }`. No behavior regression — restore path unchanged.
- Regression guard: `test-v2.mjs` — asserts `JSON.stringify(createProjectPayload(model))` does not contain `"originalHtml"` key or `<script` markers; asserts round-trip still works.
- **Status: Fixed.**

**P1-2: V2 has almost no security test coverage**
- File: `scripts/test-security.mjs`
- Root cause: The file had extensive forbidden-API checks for V1 (app-shell, importer, exporter, etc.) but only 2 checks for V2: presence of `contentDocument` and `stripUnsafeHtml`. V2's absence of network APIs (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, telemetry) was not validated.
- Fix: Added `assertForbidden(v2Code, [...], 'v2-network')` and `assertForbidden(v2Code, [...], 'v2-telemetry')` checks.
- **Status: Fixed.**

**P1-3: lint.mjs and typecheck.mjs only validate V1 code**
- Files: `scripts/lint.mjs`, `scripts/typecheck.mjs`
- Root cause: V2 is now the primary app but lint checked only `app-shell.mjs` (V1) for `safePreviewPlaceholder`, and typecheck only checked V1 for `@typedef`. V2 had no contract coverage.
- Fix: `lint.mjs` — added V2 checks for `stripUnsafeHtml`, `blockRemoteAttributes`, and `sandbox=` in index.html. `typecheck.mjs` — added checks for required V2 export names (`mapHtmlToModel`, `exportModelToHtml`, `createProjectPayload`, `restoreProjectPayload`, `stripUnsafeHtml`, `createLivePreviewHtml`).
- **Status: Fixed.**

### P2 — Quality improvement

**P2-1: `<meta http-equiv="refresh">` not stripped in edit mode**
- File: `apps/desktop-v2/src/app-v2.mjs`
- Root cause: V1's `preview-sandbox.mjs` strips meta refresh (`stripMetaRefresh`). V2's `sanitizeByMode` edit path did not. In the edit frame (`sandbox="allow-same-origin"`, no scripts), a meta refresh tag navigates the iframe to another URL, losing the editing session.
- Fix: Added `.replace(/<meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi, '')` in the edit-mode branch (ported from V1 exact pattern).
- Regression guard: `test-v2.mjs` — asserts meta refresh stripped in edit mode; non-meta content preserved.
- **Status: Fixed.**

**P2-2: finishTextEdit pushes history on Escape (cancel)**
- File: `apps/desktop-v2/src/app-v2.mjs`
- Root cause: `finishTextEdit(commit)` called `pushHistory(history, model)` unconditionally. When the user presses Escape (`commit=false`), the DOM text is restored, but the undo stack still gets a new entry for a no-op. The undo button becomes active for nothing.
- Fix: Wrapped `pushHistory` with `if (commit)`. One-line change. `commitFrameToModel()` and `render()` still run on both paths for state consistency.
- **Status: Fixed.**

**P2-3: MANUAL_PILOT_GUIDE.md timestamp format mismatch**
- File: `docs/MANUAL_PILOT_GUIDE.md`
- Root cause: Guide said pilot folder is `local-html-editor-pilot-v<version>-<YYYYMMDD-HHMMSS>/`. Actual script uses `Date.now()` (Unix ms) with no version prefix.
- Fix: Updated to `local-html-editor-pilot-<timestamp>/` and updated expected build output to list V2 files.
- **Status: Fixed.**

**P2-4: test-e2e.mjs had no V2 docs consistency checks**
- File: `scripts/test-e2e.mjs`
- Root cause: E2E smoke tests checked V1 milestone markers in docs (Phase 6A in MASTER_PLAN, ROADMAP, PROGRESS, README) but nothing about V2 status.
- Fix: Added checks that PROGRESS.md contains `"PR #56"` and `"V2 interaction polish"`, and README.md contains `"V2 MVP pilot"`.
- **Status: Fixed.**

### P3 — Document only, no code change

**P3-1: package-pilot.mjs V1 fallback is dead code**
- `hasV1 = existsSync('dist/src/app-shell.mjs')` — this path is never produced by `build.mjs` (V2-only build). The condition is harmless but never true. Candidate for cleanup in a future dedicated V1-removal PR if all V1 tests/build references are also cleaned up.

**P3-2: rgbToHex treats transparent as #000000**
- `getComputedStyle(el).backgroundColor` returns `rgba(0,0,0,0)` for transparent elements. The `rgbToHex` regex matches and returns `#000000`. Inspector background color shows black for transparent elements. Known limitation; not worth the complexity of alpha-aware handling for this MVP.

**P3-3: insText.onchange uses textContent, losing nested HTML**
- Setting `selectedEl.textContent = value` replaces all child nodes with a text node. Editing a `<div>` that contains `<span>` children will flatten the structure. Acceptable for micro-editing of text-dominant elements; known limitation.

**P3-4: No CSP meta injection in edit frame**
- V1 injects `default-src 'none'` via a meta CSP tag in the preview document. V2 edit mode relies solely on `sandbox="allow-same-origin"` (no `allow-scripts`). The sandbox attribute is the primary isolation mechanism and is sufficient; the CSP would be defense-in-depth. Not implementing now as the srcdoc injection approach would require restructuring the iframe load path.

**P3-5: Sandbox validation in test-v2.mjs is attribute-order dependent**
- The regex `id="live-preview-frame"[^>]*sandbox="([^"]+)"` assumes `id` comes before `sandbox` in the attribute list. Currently true in `index.html`, fragile if attributes are reordered. Low risk with a static HTML file.

---

## 4. V2 Preview/Edit Behavior Assessment

**Preview mode** (`sandbox="allow-scripts"`, no `allow-same-origin`):
- ✅ `live-preview-frame` exists with correct sandbox
- ✅ Scripts and inline handlers preserved in previewHtml
- ✅ Remote URLs (https://, //) stripped before preview load
- ✅ Mode label explains interactive behavior
- ✅ SVG data URIs now stripped (fixed)
- ⚠️ No CSP injection in preview frame — scripts run unhindered (by design; `allow-same-origin` absent so no app access)
- ⚠️ No visual indication of which slide is "active" in preview (preview renders full sourceHtml, slide switching is source-script-driven)

**Edit mode** (`sandbox="allow-same-origin"`, no `allow-scripts`):
- ✅ `edit-frame` exists with correct sandbox
- ✅ Scripts/handlers stripped in sourceHtml
- ✅ Remote URLs stripped
- ✅ Click-select works (pointerdown threshold prevents accidental drag)
- ✅ Double-click enters text editing via contenteditable
- ✅ Drag threshold = 4px before drag begins
- ✅ Escape cancels text edit (no longer pollutes undo stack after fix)
- ✅ Slide switch calls commitFrameToModel before switching
- ✅ Meta refresh stripped (fixed)
- ✅ Move/resize locked for non-absolute/fixed elements with clear status message
- ✅ x/y/w/h fields disabled when element not movable
- ⚠️ `insText.onchange` replaces all child nodes (known limitation)
- ⚠️ transparent backgrounds show as #000000 in color picker (known limitation)

---

## 5. Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| No telemetry/fetch/XHR/WebSocket in V2 code | ✅ | Confirmed by code review + new test |
| Edit frame: allow-same-origin, no allow-scripts | ✅ | Enforced by index.html + test-v2.mjs + test-security.mjs |
| Preview frame: allow-scripts, no allow-same-origin | ✅ | Enforced by index.html + tests |
| Remote http/https src/href stripped | ✅ | blockRemoteAttributes |
| Remote CSS url() and @import stripped | ✅ | stripRemoteCssUrls |
| Scripts stripped in edit mode | ✅ | sanitizeByMode edit |
| Inline event handlers stripped in edit mode | ✅ | sanitizeByMode edit |
| javascript: URIs removed | ✅ | sanitizeByMode (global replace) |
| SVG data URIs blocked | ✅ | Fixed in this PR |
| data:text/ URIs blocked | ✅ | Fixed in this PR |
| Meta refresh stripped in edit mode | ✅ | Fixed in this PR |
| Project file does not contain originalHtml | ✅ | Fixed in this PR |
| Restore sanitizes loaded sourceHtml | ✅ | mapHtmlToModel re-sanitizes on restore |
| No allow-forms / allow-popups / allow-downloads | ✅ | Verified in test-security.mjs |

---

## 6. Test Coverage Gaps

**Currently untestable without browser/Playwright:**
- Actual click-select / double-click / drag interactions in iframe
- Slide navigation button clicks
- Inspector onchange events
- Preview ↔ Edit mode toggle
- Image add flow end-to-end

**Added by this PR (Node-testable):**
- SVG data URI blocked by sanitizer
- data:text/ URI blocked by sanitizer
- originalHtml not in project payload
- `<script>` not in project payload
- Meta refresh stripped in edit mode

**Still missing (would require Playwright):**
- Text edit commit then undo sequence via UI
- Drag operation updating exported HTML
- Slide switch then export preserving edits
- Button selectable-but-non-functional in edit mode

---

## 7. Legacy/Dead Code Candidates

| Item | Status | Recommendation |
|------|--------|----------------|
| `apps/desktop/` (V1) | Still referenced by test.mjs, test-e2e.mjs, test-security.mjs, lint.mjs, typecheck.mjs | **Retain.** Do not delete until all V1 test/security references are removed in a dedicated PR. |
| `package-pilot.mjs` `hasV1` fallback | Dead (build.mjs only produces V2) | Harmless. Candidate for cleanup with V1 removal. |
| V1 `MANUAL_PILOT_GUIDE.md` step 4 (V1 file listing) | Stale — updated in this PR | Fixed. |
| `test-e2e.mjs` V1 UI element checks | Still valid while V1 is reference app | Retain. |

---

## 8. Docs Inconsistencies Found and Fixed

| Doc | Issue | Fix |
|-----|-------|-----|
| `docs/MANUAL_PILOT_GUIDE.md` | Pilot folder format said `YYYYMMDD-HHMMSS` | Updated to `Date.now()` epoch format |
| `docs/MANUAL_PILOT_GUIDE.md` | Build output listed V1 `dist/src/app-shell.mjs` | Updated to V2 `dist/app-v2.bundle.js` |

---

## 9. Safe Fixes Made

All changes are in `apps/desktop-v2/src/app-v2.mjs`, `scripts/`, and `docs/`. No V1 code was modified. No new dependencies were added.

| File | Change |
|------|--------|
| `apps/desktop-v2/src/app-v2.mjs` | `blockRemoteAttributes`: added `isBlockedDataUrl` helper, drops SVG and data:text/ URIs |
| `apps/desktop-v2/src/app-v2.mjs` | `sanitizeByMode` edit path: strip `<meta http-equiv="refresh">` |
| `apps/desktop-v2/src/app-v2.mjs` | `createProjectPayload`: explicit field selection omitting `originalHtml`/`previewHtml` |
| `apps/desktop-v2/src/app-v2.mjs` | `finishTextEdit`: guard `pushHistory` with `if (commit)` |
| `apps/desktop-v2/src/app-v2.mjs` | `addImageBtn.onclick`: MIME validation before DOM insertion |
| `scripts/test-v2.mjs` | Import `stripUnsafeHtml`; add SVG/meta-refresh/payload tests |
| `scripts/test-security.mjs` | V2 network/telemetry forbidden API checks |
| `scripts/lint.mjs` | V2 safety token presence checks |
| `scripts/typecheck.mjs` | V2 required export function checks |
| `scripts/test-e2e.mjs` | V2 docs consistency checks (PR #56, V2 interaction polish, V2 MVP pilot) |
| `docs/MANUAL_PILOT_GUIDE.md` | Folder name format; build output section |

---

## 10. Recommended Next PR

**Suggested: Phase 9B — V2 interaction quality pass**

Focus on the real user-reported issues from before PR #56 that the codebase hasn't yet addressed in tests:
- Slide navigation correctness: ensure switching slides and then exporting includes edits from all slides
- Move/resize feedback: clearer visual indication when an element is locked vs. movable
- Inspector text field sync: after drag, the inspector x/y should update live without requiring a click
- `insText` partial edit: preserve child HTML when editing simple text wrappers

Do not start Playwright, ZIP extraction, or major refactors.

---

## 11. Updated Manual Pilot Checklist (V2)

Use `tests/fixtures/from_answers_to_tools_v3.html` or `tests/fixtures/v2-simple-slide.html` as test input.

**Open and preview:**
1. Launch `START_HERE.bat` → `http://localhost:8765`
2. Click **Open HTML**, select a fixture file
3. App opens in Edit mode; verify slide list populated in sidebar
4. Click **Preview** → presentation renders interactively in iframe (buttons/nav may work if self-contained)
5. Click **Edit** → returns to edit mode

**Edit mode operations:**
6. Click an element → blue outline appears, inspector populates
7. Double-click a text element → cursor appears, type to edit
8. Press Enter (or click away) → edit commits; Undo becomes active
9. Press Undo → text reverts
10. Press Escape mid-edit → edit cancelled, undo NOT activated
11. Drag a positioned (absolute/fixed) element → moves; Undo records it
12. Click a non-positioned element → status bar says "move/resize locked"
13. Change X/Y/W/H in inspector for a positioned element → position updates

**Add/Delete:**
14. Click **Add Text** → new text block appears at position 80,80
15. Select it, click **Delete** → removed
16. Click **Add Image** → file picker; select a PNG → image added at position 80,120
17. Try to add an SVG → status bar shows "Only PNG, JPEG, GIF, WebP, AVIF images are supported."

**Slide navigation:**
18. If fixture has multiple slides, click Slide 2 in sidebar → display switches
19. Edit text in Slide 2, click Slide 1 → Slide 1 shows; click Slide 2 → edit preserved

**Save and reopen:**
20. Click **Save Project** → downloads `project.lheproj-v2.json`
21. Open the JSON in a text editor: confirm no `originalHtml` key, no `<script>` tags
22. Click **Open Project**, select the downloaded file → state restores with correct slide

**Export:**
23. Click **Export HTML** → downloads `edited-v2.html`
24. Open in browser → presentation renders with edits, no script execution

**Known limitations:**
- Move/resize only works for elements with `position: absolute` or `position: fixed`
- Text editing replaces all child HTML in container elements
- Preview mode after project restore does not run original scripts (only sanitized content)
- Transparent element backgrounds show as black (#000000) in the color picker
