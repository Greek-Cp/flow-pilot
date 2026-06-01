# Flow Pilot Constitution

## Core Principles

### I. Existing-Project First
Every change MUST begin by reading the current Flow Pilot codebase, storage shape, webview behavior, MCP server entry points, and Spec Kit assets before defining contracts or implementation tasks. New work MUST extend existing modules unless a focused new module reduces real complexity. Generated specs MUST name the real files they affect.

### II. Spec Is Source Of Truth
Feature work, bug fixes, UI behavior, MCP tools, and data contracts MUST start from a feature specification, technical plan, task list, and contract documents under `specs/`. Implementation MUST be traceable back to those documents. If implementation discoveries change scope, update the spec documents before or alongside code.

### III. Traceable Node Contract
Every code-backed flow node MUST be traceable to source through a stable node id, label, type, relative file path, 1-based start line, 1-based end line, symbol name when known, evidence, reason, confidence score, and relationships. Conceptual nodes are allowed only when no source evidence exists, and MUST be clearly marked with null file/line mapping and lower confidence.

### IV. Interactive Canvas Correctness
The Flow Viewer canvas MUST support predictable pan, zoom, fit, reset, click, select, inspect, and jump-to-code behavior. Mouse drag and trackpad scroll MUST pan naturally. Intentional zoom MUST preserve focus around the pointer or viewport center. Rendering MUST not reset the view except on explicit diagram load, fit, or reset.

### V. MCP Contract Stability
MCP tools MUST expose explicit, versioned input/output contracts. Additive fields are preferred over breaking changes. Existing `generate_flow` clients MUST continue to receive the current response shape while gaining richer optional node metadata. New detail tools MUST return stable error codes and schema versions.

### VI. Evidence-Based Analysis
Flow Pilot MUST not present source-backed nodes as facts without evidence from scanned files, filenames, symbols, or code snippets. Each generated node SHOULD explain why it was included, and detail tools SHOULD expose source evidence and relationship rationale.

### VII. Maintainability
Implementation MUST stay small, modular, and testable. Shared logic belongs in reusable TypeScript modules rather than duplicated branches where practical. Files that are already entry points may orchestrate, but should not accumulate unrelated domain logic.

### VIII. UX Follows VS Code
Visual styling, commands, file opening behavior, keyboard accessibility, theme variables, and feedback messages MUST follow VS Code conventions. Webviews MUST respect VS Code colors and avoid surprising browser-page interactions that conflict with editor-like canvas expectations.

### IX. Testable Acceptance Criteria
Every feature or bug fix MUST define observable acceptance criteria and verification steps. At minimum, run TypeScript compilation for code changes. Add unit tests for pure contract/detail behavior when practical, and record manual verification for VS Code webview interactions that cannot be automated cheaply.

## Technical Boundaries

Flow Pilot is a VS Code extension plus MCP stdio server. Runtime code lives in `src/`, webview assets live in `webview/`, generated JavaScript lives in `out/`, persisted data lives in `.flow-pilot/`, and feature documentation lives in `specs/`.

The canonical flow schema is the TypeScript model in `src/types/flow.ts`. Storage validation in `src/storage/validation.ts` is the gatekeeper for persisted flows. Any persisted schema expansion MUST be backward-compatible with older flow JSON unless a migration is documented.

The extension-host MCP server and standalone MCP server MUST expose matching tool behavior. Standalone code may avoid VS Code APIs, but contracts and response shapes MUST stay aligned.

## Development Workflow

1. Read existing code and Spec Kit files.
2. Update the constitution when project rules are missing or stale.
3. Create or update `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, and `tasks.md`.
4. Analyze consistency between constitution, spec, plan, tasks, and contracts before implementation.
5. Implement in small scoped changes.
6. Verify with compile/tests and documented manual checks.

## Governance

This constitution supersedes informal project habits. Specs and implementation that violate core principles require documented justification in `plan.md` Complexity Tracking. Amendments require updating this file with a new version and date, plus updating impacted templates or specs when needed.

**Version**: 1.0.0 | **Ratified**: 2026-06-01 | **Last Amended**: 2026-06-01
