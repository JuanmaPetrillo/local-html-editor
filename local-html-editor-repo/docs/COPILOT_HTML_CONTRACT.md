# Copilot HTML Contract

## Purpose

Microsoft 365 Copilot Chat can generate the initial HTML presentation. This document defines how to ask it for output that will be easier and safer for the local editor to import.

## Recommended Copilot prompt

```text
Create an interactive HTML presentation as a single local HTML file.
Important constraints:
- Do not use external CDNs, remote fonts, remote images, analytics, or external APIs.
- Keep all CSS and JS inside the file unless I explicitly ask for separate assets.
- Mark editable regions using data attributes:
  - data-lhe-token="stable-human-readable-id"
  - data-lhe-editable="text image move resize style-basic"
  - data-lhe-lock="structure" for locked structural elements
- Only mark visible text and images as editable.
- Do not mark scripts, layout wrappers, or navigation logic as editable.
- Use relative paths for any assets.
- Keep interactions in vanilla JavaScript.
- Make text containers tolerant to 20-25% longer copy without overflow.
- Avoid absolute local file paths.
```

## Prompt for normalizing existing HTML

```text
Take this existing HTML and return a functionally equivalent version prepared for local no-code editing.
Add stable data attributes:
- data-lhe-token for visible editable text and image elements
- data-lhe-editable for allowed operations
- data-lhe-lock for layout-critical or script-driven structure
Do not change scripts unless required.
Do not add external dependencies.
Do not use remote resources.
Preserve visual layout and interactions.
```

## Prompt for generating manifest

```text
From this HTML, generate a manifest JSON that lists editable nodes.
Each editable node must include:
- token
- selector
- kind: text | image | container | decorative
- allowedOps
- constraints
- defaultValue
Also list remote references and locked regions.
```

## Rules for Copilot-generated decks

Preferred:

- one HTML file
- vanilla JS
- local assets
- CSS variables
- stable data attributes
- responsive but simple layout

Avoid:

- CDN scripts
- remote fonts
- embedded iframes
- analytics
- live APIs
- framework bundles
- obfuscated/minified JS
- hardcoded absolute local paths
