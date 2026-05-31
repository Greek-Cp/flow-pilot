# Research: Flow Pilot Technical Decisions

**Date**: 2026-05-31
**Feature**: Flow Pilot — AI-Powered Code Flow Visualizer

## R1: Diagram Rendering Engine

**Decision**: Mermaid.js v10+

**Rationale**:
- De-facto standard for text-based diagram rendering
- Supports both flowchart and sequence diagram syntax
- Outputs SVG which works inside VS Code Webview
- Large community, well-documented, actively maintained
- No licensing concerns (MIT license)

**Alternatives considered**:
- **D3.js**: More powerful but requires manual diagram layout — significantly more complex for the same result
- **Graphviz (via WASM)**: Heavy dependency, poor browser integration, hard to bundle in VS Code extension
- **PlantUML**: Requires Java runtime — not viable for VS Code extension distribution
- **Custom renderer**: Massive effort, reinventing the wheel for no user benefit

---

## R2: MCP Server Implementation

**Decision**: Use `@modelcontextprotocol/sdk` (official MCP TypeScript SDK)

**Rationale**:
- Official SDK maintained by Anthropic
- First-class TypeScript support
- Handles protocol negotiation, tool registration, and transport
- Works as stdio transport (standard for VS Code MCP integration)
- Well-documented API for defining tools with JSON Schema inputs

**Alternatives considered**:
- **Custom JSON-RPC implementation**: Reinventing the protocol — error-prone and maintenance burden
- **REST API server**: Not aligned with MCP ecosystem, requires separate process management
- **Language Server Protocol (LSP)**: Different protocol designed for language features, not AI tools

---

## R3: Webview Communication Architecture

**Decision**: Message-passing via `postMessage` / `onDidReceiveMessage` (VS Code standard)

**Rationale**:
- VS Code Webview API enforces message-passing (no direct Node.js access in Webview)
- Standard pattern documented by VS Code team
- Supports bidirectional communication
- Type-safe with shared message type definitions

**Alternatives considered**:
- **Shared file state**: Race conditions, no real-time updates
- **WebSocket server**: Over-engineered for local extension, security concerns
- **WebView Panel URI scheme**: Complex setup, unnecessary for this use case

---

## R4: Storage Strategy

**Decision**: JSON files in `.vscode/flow-pilot/` directory (workspace-scoped)

**Rationale**:
- Workspace-scoped: each project has its own flow history (matches user mental model)
- JSON files: human-readable, debuggable, easy to export/backup
- Two-tier design: `history.json` (lightweight index, always loaded) + `flows/{flowId}.json` (full data, loaded on demand)
- No external database dependency
- Survives VS Code restarts without globalState migration issues

**Alternatives considered**:
- **VS Code globalState**: Not workspace-scoped, harder to debug, size limits (~5MB)
- **VS Code workspaceState**: Same limitations as globalState
- **SQLite**: External dependency, overkill for this scale
- **IndexedDB in Webview**: Lost on Webview dispose, not persistable across sessions

---

## R5: Mermaid Rendering in Webview

**Decision**: Client-side Mermaid.js rendering inside Webview with CSP-compliant script loading

**Rationale**:
- Mermaid.js runs in the browser (Webview is a browser context)
- Render to SVG, then attach click event listeners to SVG nodes
- CSP must allow `script-src` for Mermaid's inline script execution
- Use `mermaid.render()` API to generate SVG string, then inject into DOM
- SVG nodes get stable IDs from Mermaid output for click handling

**Implementation approach**:
1. Bundle `mermaid.min.js` in the extension's `webview/` directory
2. Load via `<script>` tag in Webview HTML (CSP `script-src` allows this)
3. Call `mermaid.initialize({ theme: 'base', themeVariables: {...} })` using VS Code CSS variable values
4. Call `mermaid.render(id, mermaidSource)` to get SVG
5. Insert SVG into DOM, attach `click` event listeners to `<g>` nodes

**Alternatives considered**:
- **Server-side rendering (Node.js)**: Adds complexity, Mermaid's Node.js API has different behavior than browser
- **iframe isolation**: Unnecessary, adds communication overhead
- **Pre-rendered static images**: Loses interactivity

---

## R6: Codebase Scanning Strategy

**Decision**: AI-driven scanning via MCP tool context (language-agnostic)

**Rationale**:
- The AI (Claude/Copilot) performs the actual code understanding
- Flow Pilot provides workspace file listing and keyword search utilities
- The MCP tool receives the user's prompt and uses the AI's code understanding to identify relevant files
- No language-specific parsers needed — works on any codebase
- File discovery uses VS Code's built-in `workspace.findFiles()` API

**Scanning pipeline**:
1. Extract keywords from user prompt
2. Use `workspace.findFiles()` to discover relevant files by keyword matching
3. Read file contents via VS Code's `workspace.openTextDocument()`
4. Pass file contents + user prompt to AI for flow analysis
5. AI returns structured node/edge data
6. Convert to internal Flow model

**Alternatives considered**:
- **Static analysis (AST parsing)**: Requires language-specific parsers per language — massive scope
- **grep/ripgrep integration**: Low-level, doesn't understand code semantics
- **Language Server Protocol**: Designed for IDE features, not code flow analysis

---

## R7: Node Click Handling in SVG

**Decision**: Data-attribute based node identification with event delegation

**Rationale**:
- Mermaid generates SVG with `<g>` elements for nodes
- Each node gets a `data-id` attribute corresponding to the internal node ID
- Single event listener on SVG container (event delegation) — efficient
- On click, find closest `[data-id]` element, look up node metadata
- Send message to extension host with node ID for inspector display

**Implementation**:
```javascript
svgElement.addEventListener('click', (e) => {
  const nodeGroup = e.target.closest('[data-id]');
  if (nodeGroup) {
    const nodeId = nodeGroup.getAttribute('data-id');
    vscode.postMessage({ type: 'nodeClick', payload: { nodeId } });
  }
});
```

---

## R8: Zoom and Pan Implementation

**Decision**: CSS `transform: scale() translate()` with pointer event tracking

**Rationale**:
- Pure CSS transform — hardware accelerated, smooth
- No library dependency (keeps bundle small)
- Zoom: `scale()` via mouse wheel / pinch gesture / toolbar buttons
- Pan: `translate()` via mouse drag
- State tracked in JavaScript: `{ scale: 1.0, translateX: 0, translateY: 0 }`
- Min scale: 0.25 (25%), Max scale: 3.0 (300%)

**Interaction disambiguation**:
- Pointer down → start tracking
- Pointer move < 5px → treat as click (node selection)
- Pointer move ≥ 5px → treat as pan (drag)
- Pointer up → end tracking, fire click if < threshold

**Alternatives considered**:
- **SVG viewBox manipulation**: More complex, harder to sync with CSS
- **Pan-zoom library (e.g., panzoom)**: External dependency, overkill for this use case
- **Browser native zoom**: Not controllable programmatically

---

## R9: Extension Activation Events

**Decision**: Activate on `onView:flowpilot.history` and `onCommand:flowpilot.openHistory`

**Rationale**:
- Lazy activation: extension only loads when user opens the Flow Pilot panel
- `onView` activation is the standard VS Code pattern for sidebar panels
- `onCommand` allows activation via command palette
- Does NOT activate on `*` (startup) — avoids impacting VS Code boot time

---

## R10: Testing Strategy

**Decision**: Vitest for unit tests + `@vscode/test-electron` for integration tests

**Rationale**:
- Vitest: fast, modern, TypeScript-first test runner for unit tests
- `@vscode/test-electron`: official VS Code test runner for extension integration tests
- Unit tests cover: storage, validation, flow builder, mermaid builder (pure logic, no VS Code dependency)
- Integration tests cover: extension activation, command registration, MCP tool invocation
- Contract tests cover: MCP tool input/output schema validation

**Alternatives considered**:
- **Jest**: Works but Vitest is faster and has better ESM support
- **Mocha**: Older, more boilerplate, VS Code used to recommend it but Vitest is now preferred
- **No tests**: Violates constitution principle III (Defensive Engineering)

