# Data Privacy

## Privacy objective

Presentation content must remain on the user's device.

## Data types

The app may process:

- HTML presentation files
- local image/video/font assets
- internal project manifests
- editor state
- revisions/history
- validation reports
- screenshots generated for local comparison

## Prohibited data flows

The app must not send any of the above to:

- external APIs
- analytics services
- telemetry services
- cloud storage
- AI services
- crash-reporting services
- CDNs

## Logs

Logs must avoid storing full presentation content.

Allowed:

- error type
- file extension
- synthetic fixture names
- validation category
- blocked remote hostname if needed for user warning

Avoid:

- full HTML content
- screenshots of sensitive decks
- full local path unless necessary
- personal names from content
- copied snippets from decks

## Storage

Internal project state should be stored either:

- in a user-selected project folder, or
- in a clearly documented app data folder

The user should be able to delete local drafts/history.

## Export privacy

Exported HTML must not include:

- absolute local file paths
- editor debug metadata unless user chooses debug export
- hidden original source copies
- blocked remote URLs silently re-enabled
