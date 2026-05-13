# Import and Export Specification

## Import strategy

- Arbitrary HTML import is best-effort.
- The importer must preserve original source and avoid destructive rewrites.
- Unsupported complex content is preserved/locked and still previewed when safe.

## Import outcomes

Imported content should be classified as:

- editable
- partially editable
- locked/preserved

## Export strategy

- Export should apply controlled edits to original HTML when possible.
- Unsupported locked content should remain preserved in exported output.
- Export must avoid leaking absolute local paths.
