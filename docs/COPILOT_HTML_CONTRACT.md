# Copilot HTML Contract

## Purpose

Define recommended (not mandatory) metadata conventions that improve editability for Copilot-generated presentations.

## Key rule

Edit-ready metadata is optional and recommended, not required.

The editor must still support arbitrary HTML as best-effort even when metadata is absent.

## Recommended metadata

- `data-lhe-slide` for stable slide grouping
- `data-lhe-id` for stable object identity
- `data-lhe-editable` for editability hints
- Stable object IDs that persist across small copy/layout revisions

## Design-quality requirement

Copilot should preserve premium design quality and add only invisible editability metadata.

Metadata should not degrade styling, spacing, animation quality, or visual polish.
