# Implementation Plan: Flow Pilot — AI-Powered Code Flow Visualizer

**Branch**: `001-core-flow-visualizer` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-core-flow-visualizer/spec.md`

## Summary

Flow Pilot is a VS Code Extension integrated with MCP that enables developers to generate interactive code flow diagrams from natural language prompts. The extension scans codebases using AI, produces Mermaid flowchart and sequence diagrams, renders them in a zoomable/pannable/clickable Webview, provides an inspector panel for node details with source code navigation, and persists all results to a workspace-scoped JSON history.

**Technical approach**: TypeScript VS Code Extension using the VS Code Extension API and Webview API. Mermaid.js for diagram rendering as SVG inside Webview. MCP (Model Context Protocol) server for the `generate_flow` tool. JSON file-based storage in `.vscode/flow-pilot/`. Language-agnostic codebase scanning delegated to the AI via MCP.

## Technical Context

**Language/Version**: TypeScript 5.x (VS Code Extension)

**Primary Dependencies**:
- `@types/vscode` — VS Code Extension API typings
- `mermaid` (v10+) — Diagram rendering engine
- `@anthropic-ai/sdk` or MCP SDK — MCP server implementation
- `uuid` or `crypto.randomUUID` — Flow ID generation

**Storage**: JSON files in `.vscode/flow-pilot/` directory
- `history.json` — Index of all flows (lightweight, always loaded)
- `flows/{flowId}.json` — Full flow data per flow (loaded on demand)

**Testing**: VS Code Extension Test Runner (`@vscode/test-electron`) + Vitest for unit tests

**Target Platform**: VS Code Desktop (1.80+), macOS / Windows / Linux

**Project Type**: VS Code Extension + MCP Server (hybrid)

**Performance Goals**:
- Diagram interaction (zoom/pan/click) < 100ms for ≤50 nodes
- Flow generation time: AI-dependent (UI must show progress)
- History load < 200ms on extension activation

**Constraints**:
- Webview cannot access Node.js APIs directly (message-passing only)
- Mermaid rendering in Webview requires careful CSP (Content Security Policy) configuration
- MCP server runs as part of extension host process
- Hard cap: 50 nodes per diagram

**Scale/Scope**:
- Single developer workspace (not multi-user)
- History: ~100-500 flows per workspace (reasonable lifetime)
- Diagram: 5-50 nodes per flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. VS Code Native | All UI uses VS Code CSS variables, no hardcoded colors | ✅ PASS — Webview will use `var(--vscode-*)` tokens exclusively |
| II. Incremental Delivery | MVP phases are self-contained | ✅ PASS — This plan covers MVP 1 (Core Flow) with clear scope boundaries |
| III. Defensive Engineering | Error handling for all external interactions | ✅ PASS — Error handling strategy defined for: file I/O, Mermaid rendering, MCP calls, storage, corrupt data |
| IV. AI-Augmented Code Understanding | Node metadata includes id, label, type, file, lineStart, lineEnd, description | ✅ PASS — Data model defines all required node fields |
| V. Interactive Visualization | Zoom, pan, click, inspector, source navigation | ✅ PASS — All interaction requirements mapped to implementation components |
| VI. Data Integrity | Validation before storage, history persistence, corrupt recovery | ✅ PASS — Storage layer includes validation, backup-and-recovery for corrupt files |
| VII. Simplicity | YAGNI, focused scope, no over-engineering | ✅ PASS — Minimal dependencies, flat structure, hard node cap |

**Result: ALL GATES PASS (pre-design) — proceed to Phase 0**

**Post-Phase 1 Re-check**: All principles still pass after design artifacts generated. Data model validates node fields (Principle IV). Storage design includes validation and recovery (Principle VI). Webview message contract defines all interactions (Principle V). Minimal dependency set (Principle VII).

**Result: ALL GATES PASS (post-design) — proceed to task generation**

## Project Structure

### Documentation (this feature)

```text
specs/001-core-flow-visualizer/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── mcp-generate-flow.md
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
flow-pilot/
├── package.json                    # Extension manifest + dependencies
├── tsconfig.json                   # TypeScript config
├── .vscodeignore                   # Files to exclude from VSIX
├── src/
│   ├── extension.ts                # Extension entry point (activate/deactivate)
│   ├── commands/
│   │   ├── openHistoryCommand.ts   # Register: flowpilot.openHistory
│   │   ├── openFlowCommand.ts      # Register: flowpilot.openFlow
│   │   └── highlightCodeCommand.ts # Register: flowpilot.highlightCode
│   ├── mcp/
│   │   ├── server.ts               # MCP server setup and tool registration
│   │   ├── generateFlowTool.ts     # generate_flow tool implementation
│   │   ├── codebaseScanner.ts      # Workspace file discovery and keyword search
│   │   ├── flowBuilder.ts          # Convert AI output to Flow data model
│   │   └── mermaidBuilder.ts       # Convert nodes/edges to Mermaid syntax
│   ├── storage/
│   │   ├── historyStorage.ts       # CRUD for history.json index
│   │   ├── flowStorage.ts          # CRUD for individual flow JSON files
│   │   └── validation.ts           # Data validation before write
│   ├── webview/
│   │   ├── historyViewProvider.ts  # WebviewViewProvider for History panel
│   │   ├── flowViewerProvider.ts   # WebviewPanel for Flow diagram viewer
│   │   ├── webviewHtml.ts          # HTML template generation for webviews
│   │   └── messageHandler.ts       # Webview ↔ Extension message routing
│   └── types/
│       ├── flow.ts                  # Flow, Node, Edge, Diagram interfaces
│       └── history.ts              # HistoryEntry, HistoryIndex interfaces
├── webview/
│   ├── history/
│   │   ├── index.html              # History page HTML
│   │   ├── history.js              # History page logic
│   │   └── history.css             # History page styles
│   ├── viewer/
│   │   ├── index.html              # Flow viewer HTML
│   │   ├── viewer.js               # Viewer logic (zoom, pan, click, inspector)
│   │   └── viewer.css              # Viewer styles
│   └── shared/
│       ├── mermaid-init.js          # Mermaid initialization for Webview
│       └── theme.css               # VS Code theme variable mappings
└── tests/
    ├── unit/
    │   ├── storage/
    │   │   ├── historyStorage.test.ts
    │   │   ├── flowStorage.test.ts
    │   │   └── validation.test.ts
    │   ├── mcp/
    │   │   ├── flowBuilder.test.ts
    │   │   └── mermaidBuilder.test.ts
    │   └── types/
    │       └── flow.test.ts
    ├── integration/
    │   ├── extension.test.ts        # Full extension activation test
    │   └── mcp-server.test.ts       # MCP tool invocation test
    └── contract/
        └── generate-flow.test.ts    # MCP tool contract test
```

**Structure Decision**: Single project structure. The extension is a single VS Code extension package with an embedded MCP server. Webview assets are served from the `webview/` directory. Tests follow the standard VS Code extension test pattern with unit, integration, and contract layers.

## Complexity Tracking

> No constitution violations detected. All principles pass. No complexity justification needed.
