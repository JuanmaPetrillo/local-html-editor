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

### Phase 5A: Trusted-shell nudge movement ✓

- Button-based nudge movement is complete for selected overlay-ready inline-style objects.
- Free drag movement remains pending.
- Resize remains pending.

## Current focus

### Phase 5B: constrained drag movement and UX cleanup ✓

- Constrained trusted-shell overlay drag movement is complete for safely movable objects while preserving current trust boundary and script-off preview model.
- Keep advanced controls understandable for non-technical users (including possible panel cleanup/collapse follow-up).
- Resize remains out of scope for this slice.

## Future phases

### Phase 6: Image replacement
### Phase 7: ZIP/assets import-export
### Phase 8: Packaging/non-admin distribution
### Phase 9: Pilot hardening

## Strategy guardrails across all phases

- Arbitrary HTML support is best-effort; full editability is not guaranteed.
- Edit-ready Copilot metadata is recommended and supported, not required.
- Unsupported complex content must be preserved and previewed, not destructively rewritten.
- Final UX target is a local visual editor for non-technical users, not a code editor.
- Current browser-first MVP remains a foundation/proof of concept.
