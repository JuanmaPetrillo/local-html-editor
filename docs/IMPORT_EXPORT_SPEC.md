# Import and Export Specification

## Supported inputs

MVP inputs:

- `.html`
- `.htm`
- `.zip` preflight signature check only in current browser-first MVP (no extraction/listing/export yet)

Later inputs:

- folder import
- multi-page deck bundles
- template packages

## Import goals

The importer must:

- preserve original source
- detect local assets
- detect remote URLs
- classify editable vs preserved regions
- create project manifest
- create initial editor state
- avoid executing imported scripts during import

## Import classification

### Fully editable

- text blocks
- headings
- paragraphs
- buttons/CTA text
- images and alt text
- simple layout containers
- absolute/fixed-position elements
- width/height/transform/position styles

### Preserve and preview

- simple JS widgets
- counters
- reveal animations
- carousels
- tabs
- timeline interactions

### Preview-only / unsupported

- canvas/WebGL content
- complex framework hydration
- remote embeds
- analytics snippets
- live API integrations
- forms that submit externally

## Project manifest example

```json
{
  "schemaVersion": 1,
  "source": {
    "type": "html",
    "originalFileName": "presentation.html",
    "sha256": "synthetic-placeholder"
  },
  "import": {
    "createdAt": "2026-05-11T00:00:00Z",
    "remoteReferences": [],
    "warnings": []
  },
  "assets": [
    {
      "id": "asset-001",
      "originalPath": "images/hero.png",
      "localPath": "assets/hero.png",
      "type": "image/png"
    }
  ],
  "editableNodes": [
    {
      "token": "title-main",
      "selector": "[data-lhe-token='title-main']",
      "kind": "text",
      "allowedOps": ["editText", "move", "resize"],
      "constraints": {
        "maxChars": 120,
        "bounds": "slide"
      }
    }
  ]
}
```

## Remote URL detection

The importer must detect remote references in:

- `script src`
- `link href`
- `img src`
- `source src`
- `video src`
- CSS `url(...)`
- inline JS string URLs when detectable
- form actions
- iframe src

Default action: warn and block in safe mode.

## Export formats

### HTML + assets folder

Preferred for maintainability.

```text
export/
  presentation.html
  assets/
    ...
```

### ZIP

Preferred for business-user handoff.

```text
presentation-edited.zip
```

### Single-file HTML

Optional for small decks. Inline assets only when size and policy allow.

## Export rules

- Do not include app-internal metadata unless explicitly needed.
- Do not leak absolute local paths.
- Do not include original sensitive source duplicates unless export mode requires it.
- Preserve relative links.
- Preserve unsupported but safe content.
- Keep remote references blocked or clearly flagged.


## Current browser-first MVP notes

- `importer.mjs` owns selected-file reads (`.text()` / `.arrayBuffer()`).
- `exporter.mjs` is pure helper logic and does not read files.
- Export is user-initiated local HTML download only.
- Export output is original HTML plus in-memory text patches (not sanitized preview srcdoc).
- No persistence/autosave in current slice.
