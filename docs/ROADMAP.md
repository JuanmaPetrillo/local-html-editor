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

### Phase 7: ZIP/assets import-export

- Phase 7A started: ZIP path-safety model + main-HTML selection UI scaffold.
- ZIP entry extraction/listing preview remains blocked pending approved ZIP parsing dependency.
### Phase 8: Packaging/non-admin distribution
### Phase 9: Pilot hardening

### Phase 8B: Manual pilot packaging guide (browser-first) ✓

- Added docs/scripts-only manual pilot packaging flow for `dist/` portable distribution.
- Added versioned portable-folder packaging helper (`npm run package:pilot`).
- No installer/executable packaging added in this phase.


## Next focus

- Phase 7 ZIP/assets import-export (only with explicit approval).

## Strategy guardrails across all phases

- Arbitrary HTML support is best-effort; full editability is not guaranteed.
- Edit-ready Copilot metadata is recommended and supported, not required.
- Unsupported complex content must be preserved and previewed, not destructively rewritten.
- Final UX target is a local visual editor for non-technical users, not a code editor.
- Current browser-first MVP remains a foundation/proof of concept.

### Phase 8A: Explicit local project save/reopen ✓

- Added explicit Save project / Open project flow via `.lheproj.json`.
- No autosave, no localStorage, no IndexedDB.
- Project files may contain sensitive patch data and embedded replacement images.
- Raw original HTML is not stored in project files.

- V2 pilot promoted as default packaging target with standalone non-module bundle and START_HERE launcher.

- V2 direct-canvas editor now includes multi-slide navigation and inspector/layers editing as primary pilot behavior.


### Phase 9A: V2 interaction polish ✓

- Preview/Edit mode behavior split hardened.
- Preview iframe interactivity contract and sandbox policy checks added.
- Edit interactions changed to click-select, double-click text edit, drag threshold movement.
- Slide-switch persistence and V2 contract tests expanded.

### Phase 9E: V2 polish — copy/paste, z-order, italic/underline/opacity, snap, layers ✓

- Ctrl+C/V copy-paste: copies selected element, pastes offset by 20px (respects snap), auto-selects.
- Bring to Front / Send to Back buttons (DOM reordering, undoable).
- Inspector additions: Italic, Underline, Opacity % (0–100).
- Snap to 10px grid toggle in toolbar; applied during drag, arrow nudge, and paste.
- LI, A, LABEL elements added to double-click text edit allowlist.
- Layers panel shows content text preview; includes li/a/label elements.

### Phase 9D: V2 full editor — free drag, slide management, inspector ✓

- `convertToAbsolute(el)`: any element can now be freely dragged/resized — auto-converted to `position:absolute` at its current visual position on drag start, resize handle drag, arrow-key nudge, or inspector X/Y change.
- Resize handles shown for all selected elements (not just absolute/fixed).
- Arrow-key nudge: ArrowLeft/Right/Up/Down move selected element 1px (10px with Shift); debounced 300ms commit.
- Slide management: Add Slide, Delete Slide, Duplicate Slide buttons.
- Inspector: font family select (7 web-safe fonts); text alignment select; X/Y shows visual position for non-positioned elements.
- Removed "locked" status text — drag to freely position messaging instead.

### Phase 9C: V2 keyboard shortcuts, preview-reflects-edits, image replacement ✓

- Document-level Escape key clears selection (when not in text-edit mode).
- Delete key removes selected element (ignored when focus is in inspector inputs).
- `buildLivePreviewHtml` computes live preview from current `sourceHtml` + injects original inline scripts; remote script src blocked.
- Preview mode now shows the current edited content (not the stale original), while still running original self-contained scripts.
- Inspector "Replace Image" button appears when an `<img>` is selected; validates MIME, replaces src with local data URL.

### Phase 9B: V2 overlay editor — clean selection, drag, resize ✓

- Replaced in-iframe event wiring with transparent overlay div that captures all pointer events.
- Buttons no longer activate on click in Edit mode; selection is clean.
- Text editing no longer conflicts with drag gestures.
- Ctrl+Click passes native click through (anchor/fragment navigation) without selecting.
- 8-handle resize overlay for absolute/fixed elements (drag corners and edges to resize).
- `#hover-box` shows dashed highlight on hover; `#selection-box` shows solid blue selection.
- Resize handles hidden during text edit mode, restored on commit/cancel.
- New `v2-overlay-interaction.html` fixture with multi-slide, absolute elements, button with onclick, data image, remote CSS to strip.
- Preview/Edit sandbox invariants and sanitization coverage expanded.
