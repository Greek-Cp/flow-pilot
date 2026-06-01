# Implementation Plan: Flow Runtime Correctness And Traceable MCP Details

**Branch**: `001-flow-runtime-correctness` | **Date**: 2026-06-01 | **Spec**: `specs/001-flow-runtime-correctness/spec.md`

**Input**: Feature specification from `/specs/001-flow-runtime-correctness/spec.md`

## Summary

Fix Flow Viewer navigation so normal scroll pans, intentional zoom preserves focus, and source-backed node clicks jump to code. Extend Flow Pilot's node/edge model with optional traceability metadata and add MCP detail tools for nodes and relationships while keeping `generate_flow` backward-compatible.

## Technical Context

**Language/Version**: TypeScript 5.4, browser JavaScript for VS Code webview

**Primary Dependencies**: VS Code extension API, `@modelcontextprotocol/sdk`, Mermaid

**Storage**: JSON files in `.flow-pilot/flows` and `.flow-pilot/history.json`; legacy read fallback from `.vscode/flow-pilot`

**Testing**: `npm run compile`; Vitest for pure helper behavior where added

**Target Platform**: VS Code extension host and VS Code webview; MCP stdio server

**Project Type**: VS Code extension plus MCP tool server

**Performance Goals**: Pan/zoom interactions must update in a single animation frame for typical diagrams under 50 nodes. Detail tools should read one saved flow and optional snippet synchronously within local filesystem latency.

**Constraints**: Preserve saved-flow compatibility. Do not require network access. Standalone MCP cannot depend on VS Code APIs.

**Scale/Scope**: Max 50 flow nodes per existing validator. Top 30 scanned source files per current scanner.

## Constitution Check

- Existing-Project First: PASS. Plan references existing files after audit.
- Spec Is Source Of Truth: PASS. This spec/plan/tasks/contracts precede code changes.
- Traceable Node Contract: PASS. Adds optional metadata and detail contracts.
- Interactive Canvas Correctness: PASS. Pan/zoom/jump behavior are acceptance criteria.
- MCP Contract Stability: PASS. `generate_flow` stays schema version 1 with additive fields.
- Evidence-Based Analysis: PASS. Source-backed nodes use scanner/symbol/snippet evidence; conceptual nodes are marked.
- Maintainability: PASS. Shared detail/metadata helper modules will avoid duplicating contract logic where practical.
- UX Follows VS Code: PASS. File opening uses VS Code editor APIs and webview styling remains theme-based.
- Testable Acceptance Criteria: PASS. Compile, unit tests, and manual webview checks are specified.

## Project Structure

### Documentation

```text
specs/001-flow-runtime-correctness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── analysis.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── mcp-generate-flow.md
│   ├── mcp-get-node-detail.md
│   └── mcp-get-relationship-detail.md
└── tasks.md
```

### Source Code

```text
src/
├── types/flow.ts
├── storage/validation.ts
├── commands/highlightCodeCommand.ts
├── webview/flowViewerProvider.ts
├── mcp/
│   ├── detailTools.ts
│   ├── flowMetadata.ts
│   ├── flowBuilder.ts
│   ├── generateFlowTool.ts
│   ├── server.ts
│   └── standalone.ts
└── ...

webview/viewer/
├── viewer.js
└── viewer.css

tests/
└── mcp/
    └── detailTools.test.ts
```

**Structure Decision**: Keep existing extension/webview/MCP layout. Add small MCP helper modules for metadata/detail behavior and keep standalone aligned.

## Implementation Approach

1. Expand the flow model and validation with optional metadata.
2. Add pure helper logic for metadata extraction, source snippets, and detail responses.
3. Update MCP generation to populate metadata for file and conceptual nodes.
4. Register detail tools in extension-host and standalone MCP servers.
5. Replace pan/zoom math in `viewer.js` with focus-preserving transform functions.
6. Ensure node clicks inspect all nodes and only jump to code when source mapping exists.
7. Add focused unit tests for detail helper behavior.
8. Run compile/tests and record manual verification steps.

## Complexity Tracking

No constitution violations.
