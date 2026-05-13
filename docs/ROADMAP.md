# Roadmap

## Completed phases

### Phase 1: Prompt training and helper workflow guide ✓

- Practical Copilot prompting guidance and DevTools/Notepad helper workflows documented.

### Phase 2: Visual object discovery and editability classification ✓

- Best-effort visual object extraction from arbitrary HTML.
- Objects classified as editable / partially editable / locked-preserved with plain-language reasons.
- Trusted-shell visual object inventory with overlay rendering (positioned boxes over safe preview stage).

### Phase 3: Click-to-edit visible text ✓

- Editable text candidate discovery from HTML source with source-span tracking.
- In-memory text patch collection (multiple patches, overlap detection).
- Visual object selection → text edit bridge with draft prefill and "Apply text edit to preview" workflow.
- Reset working preview to original; user-initiated local edited HTML export (Blob download).

## Current focus

### Phase 4: Move/resize simple visual elements (pending)

- Drag handles and keyboard nudging for simple positioned elements.
- Constrained, reversible geometry edits applied to in-memory working HTML.
- **Status**: not implemented. PR32 (unmerged) attempted a Phase 5A movement spike but is not merged into main and is not trustworthy for integration as-is. Do not merge PR32 without a full review of the actual diff against confirmed security invariants.

## Future phases

### Phase 5: Image replacement
### Phase 6: ZIP/assets import-export
### Phase 7: Packaging/non-admin distribution
### Phase 8: Pilot hardening

## Strategy guardrails across all phases

- Arbitrary HTML support is best-effort; full editability is not guaranteed.
- Edit-ready Copilot metadata is recommended and supported, not required.
- Unsupported complex content must be preserved and previewed, not destructively rewritten.
- Final UX target is a local visual editor for non-technical users, not a code editor.
- Current browser-first MVP remains a foundation/proof of concept.
