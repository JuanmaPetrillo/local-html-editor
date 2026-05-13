# UX Principles

## UX goal

The editor should feel closer to PowerPoint, Canva, or a lightweight presentation editor than to an HTML builder.

## Primary user flow

1. Open HTML or ZIP.
2. See the presentation immediately (target UX for a future preview milestone, not current behavior).
3. Click an element.
4. Edit text or replace image.
5. Drag/resize if needed.
6. Preview.
7. Export.

## Layout

Recommended UI:

```text
Top toolbar: Open | Save | Export | Validate | Preview | Undo | Redo
Left rail: Slides/Pages | Layers | Assets
Center: Canvas
Right rail: Inspector
Bottom status: Safe mode | blocked requests | autosave | validation status
```

## Essential MVP interactions

- click to select
- double-click text to edit
- drag selected element
- resize with handles
- snap-to-grid toggle
- smart guides
- arrow-key nudge by 1px
- Shift+Arrow nudge by 10px
- numeric X/Y/W/H fields
- lock aspect ratio
- replace image button
- edit alt text
- undo/redo

## User language

Use business-user language.

Prefer:

- Move
- Size
- Replace image
- Edit text
- Send backward
- Bring forward
- Align
- Export

Avoid exposing by default:

- DOM
- CSS transform matrix
- z-index without context
- selector
- iframe sandbox
- CSP

Advanced diagnostics can exist under an advanced/debug panel.

## Error messages

Good:

```text
This image uses an external web address. For privacy, the editor blocked it. Replace it with a local image to keep the deck fully offline.
```

Bad:

```text
CSP violation in img-src directive.
```

## Non-technical guardrails

- Confirm before overwriting source files.
- Auto-save internal project state.
- Keep original import recoverable.
- Show validation issues in plain language.
- Provide one-click export.
- Do not require users to understand HTML.

## Accessibility

The app must not require drag-only interactions.

Every drag/resize operation should also be possible through:

- keyboard nudge
- numeric fields
- align buttons
- resize controls

Images should expose alt-text editing.


## Current milestone guardrail

Rendering/preview must wait for a dedicated sandboxed preview milestone. Do not implement rendering during scan-only import milestones.


## Additional strategic UX principles

- Users should never need to know what HTML is.
- Default UI should show slides/objects, not candidate IDs or patch plans.
- Locked content must be explained plainly.
- Advanced diagnostics are hidden by default.
