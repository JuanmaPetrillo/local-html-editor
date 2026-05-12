# Master Plan

## Durable goal

Build a fully local desktop app that lets non-technical users safely edit Copilot-generated HTML presentations with simple visual controls while keeping sensitive information on the user's machine.

## Target user

A business user who can use PowerPoint or Canva-like tools but does not know HTML/CSS/JS.

The user should be able to:

- Open a downloaded `.html` file or `.zip` bundle.
- Click visible text and edit it.
- Replace an image.
- Drag, resize, align, and nudge elements.
- Preview the presentation.
- Export a working HTML file or ZIP.

## Core product decision

Do not build a generic website builder. Build a constrained presentation editor over imported HTML.

The editor should expose only safe, understandable edits. Unsupported dynamic components should be preserved and previewed, not made fully editable in MVP.

## Recommended stack

Primary stack:

- Tauri 2 desktop shell
- React + TypeScript + Vite frontend
- GrapesJS as the initial embeddable visual-editor base
- Moveable or interact.js for precise drag/resize interactions where GrapesJS is insufficient
- parse5 for HTML import/export analysis
- JSZip for ZIP import/export
- DOMPurify only at trust-boundary points where sanitized fragments are needed
- Vitest for unit tests
- Playwright for end-to-end and visual/regression checks

Fallback stack if Tauri is blocked:

- Electron with strict security hardening and portable/user-scope packaging

Do not choose a pure browser/PWA approach as the primary production architecture unless desktop packaging is blocked, because the filesystem and security model are weaker for this specific requirement.

## Milestones

### Milestone 0: Repository foundation

Deliverables:

- App scaffold decision recorded
- Tooling structure created
- Basic CI added
- Synthetic fixtures added
- No editor features yet

Acceptance criteria:

- Repo has a clear package structure.
- `npm install` / `npm test` / `npm run build` placeholders or real scripts exist.
- No runtime network dependency is introduced.
- `PROGRESS.md` is updated.

### Milestone 1: Desktop shell and project model

Deliverables:

- Tauri + React + TypeScript + Vite app shell
- Local open-file and save-file workflow
- Internal project folder structure
- Initial manifest model

Acceptance criteria:

- App opens locally.
- User can select an HTML file.
- App creates an internal project model without modifying the source file.
- No admin rights are required to run development build in CI.

### Milestone 2: Import/export pipeline

Deliverables:

- HTML file import
- ZIP import
- Asset discovery and relative path normalization
- Export as HTML + assets
- Export as ZIP
- Roundtrip fixture tests

Acceptance criteria:

- Synthetic fixture decks roundtrip without missing local assets.
- Remote URLs are detected and reported.
- The original source remains preserved.
- Exported HTML opens locally.

### Milestone 3: Editing MVP

Deliverables:

- Selectable canvas elements
- Inline text editing
- Image replacement
- Drag and resize
- Snap lines or grid snapping
- Keyboard nudging
- Undo/redo
- Inspector with numeric X/Y/W/H values

Acceptance criteria:

- A non-technical user can complete the MVP edit flow without touching HTML.
- Arrow keys move by 1px; Shift+Arrow moves by 10px.
- Undo/redo works for text, image, move, and resize operations.
- Export preserves edits.

### Milestone 4: Secure preview

Deliverables:

- Design mode with scripts disabled by default
- Isolated interactive preview mode
- Network blocking policy
- Suspicious content warnings
- Security regression fixtures

Acceptance criteria:

- Malicious fixture cannot access app APIs.
- Malicious fixture cannot read arbitrary local files.
- Remote `fetch`, XHR, WebSocket, image beacons, and script loads are blocked by default.
- Preview mode cannot weaken design-mode safety.

### Milestone 5: Packaging and non-admin distribution

Deliverables:

- Windows user-scope installer or portable build
- GitHub Actions release workflow
- Optional fixed WebView2 packaging decision
- Release checklist

Acceptance criteria:

- App can be installed or run by a normal Windows user.
- Package works offline after download.
- No admin requirement is introduced.
- Basic smoke test passes on packaged artifact.

### Milestone 6: Pilot hardening

Deliverables:

- UX polish
- Error handling
- Accessibility improvements
- Import support for real-world Copilot outputs
- Pilot guide

Acceptance criteria:

- At least 10 representative synthetic/approved decks import, edit, preview, and export.
- Non-technical pilot users can complete the basic edit flow.
- Known limitations are documented clearly in the UI and docs.

## Success metric

The app is successful when HR/business users can make 80% of common micro-edits without asking a technical person to touch HTML, while sensitive presentation content remains local and protected.
