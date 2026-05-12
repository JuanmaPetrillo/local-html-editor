# Security Policy

## Security posture

This project handles potentially sensitive internal presentation content. The app must be fully local by design.

## Sensitive data rules

Do not commit:

- real corporate presentations
- HR data
- screenshots of sensitive content
- employee data
- tokens or credentials
- customer names or confidential strategy details
- real imported HTML with sensitive information

Use synthetic fixtures only.

## Reporting security concerns

Security concerns should be tracked as private repository issues unless the repository owner defines another internal process.

A security issue must include:

- affected area
- reproduction steps
- expected safe behavior
- actual behavior
- whether sensitive data could leave the device
- recommended mitigation

## High-severity issues

Treat these as high severity:

- imported HTML can access app filesystem APIs
- imported HTML can make network calls in safe mode
- imported HTML can read arbitrary local files
- preview content can navigate the app shell
- app sends telemetry or content externally
- packaged app requires admin rights unexpectedly
- exported HTML leaks local absolute paths

## Security development rule

Never weaken sandboxing, CSP, network blocking, or permission boundaries to make a feature easier.
