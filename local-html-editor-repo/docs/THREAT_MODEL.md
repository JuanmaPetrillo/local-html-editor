# Threat Model

## Assets to protect

- sensitive presentation content
- local files on the user's machine
- employee/customer/business information embedded in HTML
- exported presentations
- internal project state and revisions
- user trust in the editor

## Adversarial inputs

- malicious HTML file
- malicious ZIP bundle
- HTML with remote scripts
- HTML with remote images/tracking pixels
- SVG with scripts or event handlers
- CSS attempting remote resource loads
- JS attempting network exfiltration
- JS attempting local file access
- malformed HTML designed to break parser assumptions

## Main threats

### T1: Data exfiltration through remote requests

Risk: Imported content sends sensitive data to an external URL.

Mitigation:

- block remote network by default
- show remote URL warnings at import
- security fixtures for fetch/XHR/WebSocket/image beacon

### T2: Privileged API access from preview

Risk: Imported content calls Tauri/Electron bridge APIs.

Mitigation:

- no app bridge in preview
- separate webview/session
- strict capabilities/permissions
- tests that assert bridge is unavailable

### T3: Arbitrary local file read

Risk: Imported content reads local files.

Mitigation:

- no filesystem permission in preview
- no broad file scope
- user-selected files are processed by trusted importer only

### T4: Destructive import rewrite

Risk: app breaks a presentation while attempting to make it editable.

Mitigation:

- preserve original source
- keep editor state separate
- classify unsupported regions as preserve/preview-only
- roundtrip fixtures

### T5: Accidental cloud/telemetry addition

Risk: dependency or feature sends content externally.

Mitigation:

- no telemetry policy
- dependency review
- runtime network tests
- no CDN usage

### T6: Admin-rights regression

Risk: release artifact requires admin rights.

Mitigation:

- user-scope installer target
- smoke test on standard user profile
- package checklist

## Security review checklist

Before merging any security-sensitive PR:

- Does it change preview execution?
- Does it change filesystem permissions?
- Does it add a network-capable dependency?
- Does it add remote URLs?
- Does it change packaging/installer permissions?
- Does it affect imported HTML handling?
- Are malicious fixtures updated?
