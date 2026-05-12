# Editable Contract

## Purpose

The editable contract defines which parts of imported HTML are safe and understandable for non-technical users to edit.

The app should not expose the entire DOM as editable by default.

## Data attributes

Preferred attributes:

```html
<h1 data-lhe-token="title-main" data-lhe-editable="text move resize">
  Annual HR Priorities
</h1>

<img
  data-lhe-token="hero-image"
  data-lhe-editable="image move resize"
  src="assets/hero.png"
  alt="Team workshop"
/>

<section data-lhe-lock="structure">
  ...
</section>
```

## Attribute definitions

### `data-lhe-token`

Stable unique identifier for the editable node.

Rules:

- must be unique in the document
- should survive export/import
- should be human-readable when possible

### `data-lhe-editable`

Space-separated operations allowed for the node.

Allowed MVP operations:

- `text`
- `image`
- `move`
- `resize`
- `style-basic`

### `data-lhe-lock`

Marks elements that should not be edited.

Suggested values:

- `structure`
- `script`
- `layout-critical`
- `preview-only`

## Operation definitions

### text

Allows editing visible text content.

Constraints:

- preserve inline formatting where possible
- enforce optional max character length
- warn on overflow

### image

Allows replacing image `src` and editing `alt`.

Constraints:

- support local image assets only
- warn on large image dimensions/file size
- preserve aspect ratio by default

### move

Allows changing position.

Constraints:

- use transforms or safe positioning strategy
- support keyboard nudge
- keep within slide/page bounds unless user confirms

### resize

Allows changing width/height.

Constraints:

- preserve aspect ratio by default for images
- support numeric inspector
- maintain min/max size rules

### style-basic

Allows limited styling:

- font size
- color from allowed palette
- background color from allowed palette
- alignment
- spacing within safe bounds

## Unsupported operations in MVP

- arbitrary JS editing
- arbitrary CSS editing
- editing script tags
- editing remote embeds
- editing form actions
- adding new complex components
- changing global app layout

## Copilot integration

When asking Copilot to generate future decks, request these attributes directly. See `docs/COPILOT_HTML_CONTRACT.md`.
