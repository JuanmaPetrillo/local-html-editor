# User Guide Draft

## What this app does

This app lets you make small visual edits to an HTML presentation without touching HTML code.

You can:

- edit visible text
- replace images
- move items
- resize items
- preview the presentation
- export a new HTML file or ZIP

## What this app does not do

It is not intended for large redesigns. For major structure changes, use Copilot Chat again or ask a technical user.

## Basic flow

1. Open the app.
2. Click **Open**.
3. Select your HTML file or ZIP.
4. Click a text or image element.
5. Edit using the right-side panel or direct canvas controls.
6. Click **Preview** to check the result.
7. Click **Export**.

## Moving elements precisely

- Drag with the mouse for rough positioning.
- Use arrow keys to move by 1 pixel.
- Use Shift + arrow keys to move by 10 pixels.
- Use the X/Y fields in the right panel for exact placement.

## Replacing images

1. Select the image.
2. Click **Replace image**.
3. Choose a local image file.
4. Add or update alt text.
5. Confirm the image still fits the slide.

## Privacy indicators

The app should show:

- Safe Mode: scripts are disabled.
- Blocked remote items: external content was blocked for privacy.
- Local export: output is saved on your computer.

## Recovery

The app preserves the original imported file in the local project. If something breaks, restore from the original or a previous revision.


## How to ask Copilot for small changes without breaking the presentation

Use small, specific requests and keep layout intent explicit. Example pattern:

- “Keep the current layout and styling. Only change the title text to: …”
- “Keep all assets local and do not add remote URLs or CDN references.”
- “Do not rewrite script logic unless necessary for the requested text/image change.”

This workflow is a support path for immediate value while visual editing capabilities expand.

## Temporary power-user workaround with DevTools/Notepad

If a needed change is currently locked in the app, a temporary fallback is:

1. Preview and identify the element to change.
2. Use DevTools to inspect likely text/image source region.
3. Make a minimal local edit in Notepad (or equivalent) without broad rewrites.
4. Re-open and validate in safe preview.

This is a temporary power-user workaround, not the target product UX. The target UX remains a local visual editor for non-technical users.
