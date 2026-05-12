# Non-Admin Distribution

## Constraint

The target user may not have administrator rights on a managed corporate Windows PC.

The release must not require:

- installing system-level dependencies manually
- running an installer as Administrator
- installing developer tools
- installing Rust, MSVC, Node, or Python on the user's PC

## Recommended workflow

Develop and package through GitHub + Codex + GitHub Actions.

User receives:

- a user-scope installer, or
- a portable ZIP/app folder, depending on what corporate policy allows

## Windows packaging strategy

Preferred:

- Tauri NSIS installer configured for current-user installation

Validate:

- normal user can install
- no UAC prompt appears
- app launches offline
- app can open/save user-selected files
- app can be deleted/uninstalled without admin

## WebView2 decision

Tauri on Windows uses WebView2.

Decision needed during packaging milestone:

### Option A: Evergreen WebView2

Pros:

- smaller package
- security updates handled by Edge/WebView2 runtime

Cons:

- depends on runtime already being present or installable
- may be affected by corporate policy

### Option B: Fixed WebView2 runtime bundled

Pros:

- more offline/reproducible
- less dependency on machine state

Cons:

- larger package
- must manage runtime updates/security

## Development on no-admin PC

The user does not need to build locally.

Recommended:

- create repo in GitHub web
- run Codex tasks in the cloud
- let GitHub Actions produce artifacts
- download artifact for testing

If local testing is needed, prefer portable Node and no-admin tools only.

## Release artifact acceptance criteria

A release artifact is acceptable only if:

- it runs under a standard Windows user account
- it does not require admin rights
- it does not require internet after download
- it does not call external services
- it opens and exports local decks
- it displays clear errors for blocked files/permissions
