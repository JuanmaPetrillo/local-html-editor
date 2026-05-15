# Import and Export Specification

## Import strategy

- Arbitrary HTML import is best-effort.
- The importer must preserve original source and avoid destructive rewrites.
- Unsupported complex content is preserved/locked and still previewed when safe.

## ZIP safety (Phase 7A)

- ZIP entry names are untrusted input.
- Reject unsafe ZIP paths (traversal, absolute, drive-path, control chars, duplicate normalized paths).
- Normalize safe paths to forward-slash form.

## Import outcomes

Imported content should be classified as:

- editable
- partially editable
- locked/preserved

## Export strategy

- Export should apply controlled edits to original HTML when possible.
- Unsupported locked content should remain preserved in exported output.
- Export must avoid leaking absolute local paths.

## Project persistence (Phase 8A)

- Persistence is explicit and user-controlled via downloadable `.lheproj.json` files.
- No autosave, no localStorage, no IndexedDB.
- Persist project metadata + text/layout/image patch collections only.
- Do not persist raw original HTML, sanitized preview documents, or srcdoc.
- Image replacement data URLs may be included for safe raster formats only.

### V2 project persistence (`.lheproj-v2.json`)

The V2 direct-canvas editor uses a different persistence model:
- The project payload stores sanitized `sourceHtml` directly (the current edit state), not patch collections.
- Schema: `{schema: 'lheproj-v2', version: 2, model: {sourceHtml, slides, selectedSlideId, mode}}`.
- `originalHtml` and `previewHtml` are NOT stored; they are recomputed from `sourceHtml` on restore.
- Image replacements are embedded in `sourceHtml` as `data:image/...;base64,...` URLs.
