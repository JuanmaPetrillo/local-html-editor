# Decisions

This file records durable project decisions.

## Decision 001: Build focused local editor, not generic builder

Status: Accepted

Decision: The app will be a constrained visual editor for Copilot-generated HTML presentations, not a general-purpose website builder.

Reason: A generic builder would increase complexity, security risk, and UX confusion. The user need is micro-editing: text, images, positioning, preview, and export.

## Decision 002: Imported HTML is untrusted

Status: Accepted

Decision: Imported HTML must never run in the same privileged context as filesystem access or app commands.

Reason: HTML decks can include arbitrary JS, remote URLs, and malicious payloads.

## Decision 003: Tauri-first desktop architecture

Status: Proposed default

Decision: Use Tauri 2 + React + TypeScript + Vite unless blocked.

Reason: Tauri supports small local desktop apps with a capability-based security model and user-scope Windows installer options.

Fallback: Electron with strict hardening and portable/user-scope packaging.

## Decision 004: Design mode scripts off by default

Status: Accepted

Decision: The default editing canvas must disable imported script execution.

Reason: Most micro-edits do not require script execution. Safe preview matters more than interactive fidelity while editing.

## Decision 005: Project state separate from exported HTML

Status: Accepted

Decision: Store internal editor state and manifest separately from exported HTML.

Reason: HTML roundtrip alone is fragile. The app needs a stable internal model for undo/redo, asset tracking, and validation.

## Decision 006: No admin requirement for end users

Status: Accepted

Decision: Release artifacts must be installable/runnable by a normal Windows user.

Reason: The target environment is a managed corporate PC where users may not have administrator rights.


## Decision 007: Browser-first static prototype through Milestone 2A

Status: Accepted

Decision: Use a static browser-first prototype for Milestones 0-2A. Defer Tauri/React/Vite/TypeScript app code until explicitly approved.

Reason: This reduces complexity and better fits no-admin managed corporate PC constraints while validating the security model early.

Impact: No agent should install or start Tauri/React/Vite implementation unless explicit approval is given in-task.
