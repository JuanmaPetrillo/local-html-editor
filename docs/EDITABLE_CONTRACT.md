# Editable Contract

## Purpose

Define best-effort editability boundaries for arbitrary imported HTML while preserving unsupported complex content.

## Editability classes

### editable

Safe, direct visual edits are supported.

### partially editable

Only limited safe edits are supported (for example text only, not layout/behavior).

### locked/preserved

Element is preserved and previewed but not directly editable in the visual workflow.

## Supported object types (future visual editor target)

- text
- image
- simple card/container

## Unsupported/locked examples

- canvas
- iframe/embed/object
- script-driven widgets
- complex SVG
- complex responsive containers

## Contract behavior requirements

- The app must not promise every HTML element is fully editable.
- Unsupported complex regions must be preserved, not destructively rewritten.
- Locked/preserved items must include plain-language explanation in UI.
