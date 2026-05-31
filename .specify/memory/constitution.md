<!-- Sync Impact Report
Version change: 0.0.0 → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (7 principles)
  - Technical Constraints
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ compatible
  - .specify/templates/spec-template.md ✅ compatible
  - .specify/templates/tasks-template.md ✅ compatible
  - .specify/templates/checklist-template.md ✅ compatible
Follow-up TODOs: none
-->

# Flow Pilot Constitution

## Core Principles

### I. VS Code Native

All UI MUST integrate seamlessly with the Visual Studio Code environment.

- Use VS Code CSS variables (`--vscode-editor-background`, `--vscode-foreground`, `--vscode-button-background`, etc.) for ALL styling
- Hardcoded colors (e.g. `#ffffff`, `#1e1e1e`) are PROHIBITED except for minimal fallbacks
- Layout MUST follow VS Code conventions: flat design, thin borders, compact sidebar, clear hover/active/focus states
- Webview components MUST support both dark and light themes without additional configuration
- Font, spacing, and typography MUST derive from VS Code theme tokens

**Rationale**: Flow Pilot is a VS Code extension. Users expect a native experience. Disjointed UI erodes trust and adoption.

### II. Incremental Delivery

Features MUST be developed and shipped in independently deployable increments.

- Each MVP phase MUST be self-contained, testable, and demonstrable
- MVP 1 (Core Flow) → MVP 2 (Better Viewer) → MVP 3 (Quality Improvement)
- A completed phase MUST NOT depend on a future phase for core functionality
- User stories within each phase MUST be independently implementable

**Rationale**: Incremental delivery reduces risk, enables early feedback, and ensures the extension provides value at every stage.

### III. Defensive Engineering

The extension MUST NEVER crash. All failure paths MUST be handled gracefully.

- Every external interaction (file I/O, Mermaid rendering, MCP calls, history storage) MUST have error handling
- Corrupt history files MUST trigger backup-and-recovery, not crash
- Mermaid rendering failures MUST fall back to showing raw source with error message
- Missing files MUST display clear "file not found" messaging with context
- Invalid node metadata MUST degrade gracefully (show available info, hide unavailable)
- All data MUST be validated before storage (flowId, title, Mermaid syntax, node/edge structure, line ranges)

**Rationale**: Developers rely on extensions during active work. A crash disrupts flow and destroys confidence in the tool.

### IV. AI-Augmented Code Understanding

Flow Pilot MUST leverage AI to read and understand codebases, then produce accurate, meaningful flow visualizations.

- AI MUST identify entry points, function call chains, state changes, API/SDK calls, and success/error paths
- Generated flows MUST map to actual source code (file paths, line ranges)
- Node metadata MUST include: id, label, type, file, lineStart, lineEnd, description
- Edge metadata MUST include: from, to, label
- AI MUST handle partial results gracefully (status: "partial") rather than failing silently
- Diagram type recommendation MUST be context-aware (flowchart for logic flows, sequence for communication flows)

**Rationale**: The core value proposition is AI reading code like an engineer and producing visual understanding. Accuracy and source mapping are non-negotiable.

### V. Interactive Visualization

Diagrams MUST be fully interactive, not static images.

- Users MUST be able to zoom (mouse wheel, pinch, buttons, 25%-300% range)
- Users MUST be able to pan/drag to navigate large diagrams
- Users MUST be able to click nodes to inspect details
- Inspector panel MUST display: node name, type, file path, line range, code snippet, incoming/outgoing relations
- Users MUST be able to open source files and highlight code ranges from the inspector
- Zoom controls MUST include: zoom in, zoom out, fit to screen, reset
- Pan MUST NOT conflict with node click interactions

**Rationale**: Static diagrams have limited value. Interactivity enables exploration, understanding, and direct code navigation.

### VI. Data Integrity and Persistence

All generated flow data MUST be validated, stored reliably, and retrievable.

- Every successful/partial flow generation MUST be saved to history automatically
- Storage format: `.vscode/flow-pilot/history.json` for index + `.vscode/flow-pilot/flows/{flowId}.json` for detail
- Required history fields: flowId, title, description, original prompt, createdAt, updatedAt, status, diagramTypes, sourceFiles, nodeCount, edgeCount
- Data validation MUST run before write: flowId exists, title exists, Mermaid valid, nodes/edges arrays valid, file paths relative to workspace, lineStart <= lineEnd
- Users MUST be able to open, rename, regenerate, delete, and export (Mermaid/JSON) flows from history
- Corrupt storage MUST trigger automatic backup and recovery

**Rationale**: History is the user's knowledge base. Data loss or corruption destroys the accumulated value of past analyses.

### VII. Simplicity

Start simple. Build only what is needed. Avoid over-engineering.

- YAGNI: Do NOT build features outside the defined scope
- Diagrams MUST NOT become so large they are unreadable (enforce reasonable node limits)
- Do NOT attempt to read entire repos when not relevant to the prompt
- Do NOT replace manual documentation, refactor code, or run applications
- Do NOT guarantee 100% call graph accuracy — be honest about limitations
- Prefer flat, readable code over clever abstractions

**Rationale**: Complexity is the enemy of reliability. A focused tool that does one thing well is more valuable than a sprawling, fragile one.

## Technical Constraints

- **Diagram Engine**: Mermaid.js for all diagram rendering
- **Rendering Target**: SVG inside VS Code Webview
- **Node Interaction**: Click event listeners attached to SVG nodes with stable IDs
- **Data Format**: JSON for all stored flow data
- **Storage Location**: `.vscode/flow-pilot/` directory (history.json + flows/{flowId}.json)
- **Theme System**: Exclusively VS Code CSS variables — no hardcoded color values
- **Supported Diagrams**: Flowchart and Sequence Diagram
- **Language**: TypeScript for extension code
- **Framework**: VS Code Extension API + Webview API

## Development Workflow

- **Specification First**: Every feature MUST start with a clear specification (`/speckit-specify`)
- **Plan Before Code**: Technical plan MUST be created before implementation (`/speckit-plan`)
- **Task Breakdown**: Implementation MUST follow structured task lists (`/speckit-tasks`)
- **Constitution Compliance**: All plans and implementations MUST be checked against this constitution
- **Git Discipline**: Feature branches, meaningful commits, no direct commits to main
- **Quality Gates**: Each phase MUST pass review before proceeding to the next

## Governance

- This Constitution is the supreme authority for all development decisions in Flow Pilot
- Constitution supersedes ad-hoc practices, convenience shortcuts, and individual preferences
- All code reviews MUST verify compliance with these principles
- Amendments require:
  1. Documented rationale for the change
  2. Version bump (MAJOR for principle removal/redefinition, MINOR for additions, PATCH for clarifications)
  3. Updated `LAST_AMENDED` date
  4. Sync Impact Report for dependent templates
- Use `CLAUDE.md` for runtime development guidance and context
- Violations MUST be justified in the Complexity Tracking section of the implementation plan

**Version**: 1.0.0 | **Ratified**: 2026-05-31 | **Last Amended**: 2026-05-31
