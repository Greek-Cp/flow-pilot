# Research: Flow Runtime Correctness And Traceable MCP Details

## Existing Project Findings

- `src/types/flow.ts` defines the canonical persisted flow model with basic nodes and edges.
- `src/storage/validation.ts` validates persisted flows and currently allows a narrow node type set.
- `webview/viewer/viewer.js` owns Mermaid rendering, native fallback rendering, pan/zoom, node selection, and inspector updates.
- `src/webview/flowViewerProvider.ts` handles webview messages and already attempts to highlight code on `nodeClick` when file metadata exists.
- `src/mcp/generateFlowTool.ts` generates flows inside the extension-host path.
- `src/mcp/standalone.ts` duplicates scanner/generator logic for stdio MCP without VS Code dependencies.
- `src/mcp/server.ts` registers the extension-host MCP tools.
- `.specify/memory/constitution.md` was still a placeholder, so project-specific Spec Driven Development rules needed to be written before feature implementation.

## Decision 1: Treat Wheel Scroll As Pan By Default

**Decision**: Normal wheel/touchpad deltas pan the canvas. Zoom occurs only through toolbar buttons or modified/pinch wheel events.

**Rationale**: VS Code users expect two-finger trackpad gestures to move content. Accidental zoom is the reported bug.

**Alternatives Considered**:

- Always zoom on vertical wheel: rejected because it reproduces the bug.
- Require a dedicated pan mode: rejected because navigation should be natural by default.

## Decision 2: Use Transform Math With Diagram Coordinates

**Decision**: Maintain `translateX`, `translateY`, and `scale`; compute the diagram coordinate under a focus point before scale changes and adjust translate after scale changes.

**Rationale**: This keeps pointer/center focus stable and avoids jumps to origin.

**Alternatives Considered**:

- CSS `zoom`: rejected because it is less predictable in webviews and harder to compose with SVG.
- Reset translation on zoom: rejected because it causes the top-left jump.

## Decision 3: Extend Flow Schema Additively

**Decision**: Add optional node and edge metadata fields instead of introducing a new required schema version for persisted flows.

**Rationale**: Existing saved flows should keep loading and existing clients should keep reading `generate_flow` responses.

**Alternatives Considered**:

- Mandatory migration of all saved flows: rejected as unnecessary for optional metadata.
- Separate metadata file per flow: rejected because node detail must travel with the flow and be easy to inspect.

## Decision 4: Add MCP Detail Tools

**Decision**: Add `get_node_detail` and `get_relationship_detail` with versioned response shapes.

**Rationale**: `generate_flow` should stay a generation tool; detail queries are separate read operations with stable contracts.

**Alternatives Considered**:

- Put all detail in `generate_flow` only: rejected because clients need focused follow-up queries and snippets.
- One generic detail tool: rejected because node and relationship inputs/outputs differ enough for separate contracts.

## Decision 5: Derive Metadata From Existing Scanner

**Decision**: For this implementation, derive source-backed metadata from scanned file path, reason, first detected symbol, line range, and snippets. Mark conceptual fallback nodes as conceptual evidence with lower confidence.

**Rationale**: The project does not yet contain a full parser/AI analysis pipeline. This produces traceable, honest metadata now and leaves room for richer symbol extraction later.

**Alternatives Considered**:

- Add full language parser support: rejected for scope and dependency risk.
- Invent source details from prompt-only flows: rejected by Evidence-Based Analysis.
