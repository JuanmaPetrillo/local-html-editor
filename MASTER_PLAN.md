# Master Plan

## Durable goal

Build a fully local visual editor for HTML presentations (especially Copilot-generated decks) so non-technical users can make common micro-edits safely without sending sensitive content to third parties.

The product must support arbitrary HTML as a best-effort input, classify what is editable, and preserve/lock unsupported complex content instead of destructively rewriting it.

## Current implementation status

- Browser-first MVP foundation is active and complete for current scope (scan/report/manifest, safe preview, text candidate discovery, in-memory text patching, reset, local edited HTML export).
- The current implementation is a proof-of-concept foundation, not the final visual-editor UX.
- ZIP remains preflight-only (no extraction/listing/export).
- No image replacement, drag/resize, persistence/autosave, or packaged desktop distribution is implemented in this branch.

## Core strategy

Build for **best-effort arbitrary HTML import** plus an **optional edit-ready Copilot contract**:

- Arbitrary HTML should import and preview as safely as possible.
- The app must not promise every HTML element is PowerPoint-editable.
- The UI should classify objects as:
  - editable
  - partially editable
  - locked/preserved
- Edit-ready Copilot metadata is recommended and supported for better results, but never required.
- Prompt training and helper guidance are part of near-term product value while visual editing UX matures.

## Target user

Primary user: non-technical business users on managed Windows PCs who need quick presentation micro-edits and should not need to read or modify HTML.

Secondary user (temporary fallback): power users who can use DevTools/Notepad helper workflows while core visual editing matures.

## Success metric

Success means users can complete most common micro-edits locally through a visual workflow, while unsupported complex content is clearly preserved/locked and the original presentation fidelity is maintained.

## Milestones / phased roadmap

### Phase 1: Prompt training and helper workflow guide

- Publish practical Copilot prompting guidance for safe micro-edits.
- Document temporary DevTools/Notepad helper workflows as support-only fallback.
- Keep clear messaging that this is not the final UX.

### Phase 2: Visual object discovery and editability classification

- Detect slide/object boundaries best-effort across arbitrary HTML.
- Classify elements into editable / partially editable / locked-preserved.
- Surface plain-language reasons for locked content.

### Phase 3: Click-to-edit visible text

- Click common visible text objects and edit in-place.
- Apply controlled edits to original HTML when possible.
- Preserve unsupported structures untouched.

### Phase 4: Move/resize simple visual elements

- Support drag/resize for simple supported object classes.
- Keep constrained, reversible edits and preserve unsupported layout logic.

### Phase 5: Image replacement

- Replace supported local images and edit alt text.
- Preserve unsupported/complex image pipelines as locked content.

### Phase 6: ZIP/assets import-export

- Add ZIP and multi-asset roundtrip support.
- Keep controlled export that preserves unsupported content.

### Phase 7: Packaging/non-admin distribution

- Produce user-scope Windows package/portable distribution.
- Validate no-admin installation/use path.

### Phase 8: Pilot hardening

- Improve reliability, UX clarity, accessibility, and fixture coverage.
- Validate with representative real-world deck variation.
