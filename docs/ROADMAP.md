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

### Phase 5B: constrained drag movement and UX cleanup ✓

### Phase 5C: constrained resize handles ✓

- Trusted-shell resize handles are complete for selected overlay-ready inline-style objects (bottom-right, right, bottom).
- Resize commits through the existing controlled layout patch/export pipeline.
- Image replacement remains pending.
- ZIP/assets import-export remains pending.
- Persistence/autosave remains pending.

## Future phases

### Phase 6A: Local image replacement ✓

- Replace selected safe `<img>` objects with user-selected local raster image files (png/jpeg/jpg/gif/webp/avif).
- Replacement is embedded as a local `data:image/...;base64,...` URL for preview/export.
- SVG replacement and non-image replacement remain blocked.

### Phase 6B: ZIP/assets import-export
### Phase 7: ZIP/assets import-export
### Phase 8: Packaging/non-admin distribution
### Phase 9: Pilot hardening

## Next focus

- Phase 6 image replacement (only with explicit approval).

## Strategy guardrails across all phases

- Arbitrary HTML support is best-effort; full editability is not guaranteed.
- Edit-ready Copilot metadata is recommended and supported, not required.
- Unsupported complex content must be preserved and previewed, not destructively rewritten.
- Final UX target is a local visual editor for non-technical users, not a code editor.
- Current browser-first MVP remains a foundation/proof of concept.
