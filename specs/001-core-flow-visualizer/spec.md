# Feature Specification: Flow Pilot — AI-Powered Code Flow Visualizer

**Feature Branch**: `001-core-flow-visualizer`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "Build Flow Pilot, a VS Code Extension integrated with MCP that helps developers visualize code flow from natural language prompts. The system analyzes codebases, generates interactive Mermaid diagrams (flowchart + sequence), renders them in VS Code Webview with zoom/pan/click interactions, provides an inspector panel for node details, enables source code navigation, and persists all results to a searchable history."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View Flow History (Priority: P1)

As a developer, when I open the Flow Pilot extension, I want to see a list of all previously generated code flows so that I can quickly revisit past analyses without regenerating them.

**Why this priority**: History is the entry point of the extension. Without it, users have no persistent value from past work. This is the first screen users see.

**Independent Test**: Open the extension panel. If no flows exist, verify the empty state message appears. Generate a flow (via any means), close and reopen the panel, verify the flow appears in the history list with title, date, diagram type, node count, and status.

**Acceptance Scenarios**:

1. **Given** the user has never generated a flow, **When** they open the Flow Pilot extension, **Then** they see an empty state message: "No flow generated yet. Ask AI to generate your first code flow using MCP."
2. **Given** the user has previously generated flows, **When** they open the extension, **Then** they see a list of flows showing: title, description, creation date, diagram type, node count, source file count, and status (success/failed/partial).
3. **Given** the user is viewing the history list, **When** they click a flow item, **Then** the flow viewer opens displaying the stored diagram.
4. **Given** the user is viewing a history item, **When** they select "Delete", **Then** the flow is removed from history after confirmation.
5. **Given** the user is viewing a history item, **When** they select "Rename", **Then** they can edit the flow title and the change persists.

---

### User Story 2 — Generate Code Flow via MCP (Priority: P1)

As a developer, I want to describe a code flow in natural language and have the AI analyze my codebase and generate an accurate flow diagram, so that I can understand how code works without manually tracing it.

**Why this priority**: This is the core value proposition of Flow Pilot. Without flow generation, there is no product.

**Independent Test**: Invoke the MCP `generate_flow` tool with a natural language prompt (e.g., "Show the login flow from email input to dashboard"). Verify that the AI scans the workspace, identifies relevant files, generates a Mermaid flowchart with clickable nodes, and saves the result to history.

**Acceptance Scenarios**:

1. **Given** a workspace with code, **When** the user invokes `generate_flow` with prompt "Show the payment flow from booking to completion", **Then** the system scans the codebase, identifies relevant files/functions/classes, and generates a Mermaid flowchart.
2. **Given** a flow generation is in progress, **When** the user views the extension, **Then** they see a progress indicator showing steps: understanding request → searching files → reading code → building nodes → generating diagram → saving.
3. **Given** the AI finds partial results, **When** generation completes, **Then** the flow is saved with status "partial" and the viewer shows which parts were found and which were missing.
4. **Given** the AI finds no relevant code, **When** generation completes, **Then** a clear error message is shown with a suggestion to refine the prompt.
5. **Given** a successful generation, **When** the process completes, **Then** the flow is automatically saved to history and appears in the history list.

---

### User Story 3 — View Interactive Diagram (Priority: P2)

As a developer, after generating or opening a flow, I want to see an interactive Mermaid diagram that I can zoom, pan, and explore so that I can understand the code flow visually.

**Why this priority**: Diagram interactivity is essential for usability. Large diagrams require zoom/pan to be readable.

**Independent Test**: Open a generated flow in the viewer. Verify the diagram renders as SVG. Use mouse wheel to zoom in/out. Drag to pan. Click the fit-to-screen button. Click the reset button. Verify all controls work smoothly.

**Acceptance Scenarios**:

1. **Given** a flow is opened in the viewer, **When** the diagram loads, **Then** the Mermaid diagram renders as SVG and is initially fit to the screen.
2. **Given** the diagram is displayed, **When** the user scrolls the mouse wheel, **Then** the diagram zooms in/out smoothly within the 25%-300% range.
3. **Given** the diagram is larger than the viewport, **When** the user drags on the canvas, **Then** the diagram pans to show other areas. Cursor changes to grab/grabbing.
4. **Given** the toolbar is visible, **When** the user clicks "Fit", **Then** the diagram scales to fit the viewport.
5. **Given** the toolbar is visible, **When** the user clicks "Reset", **Then** the diagram returns to default zoom level.
6. **Given** the diagram supports multiple types, **When** the user switches between "Flowchart" and "Sequence" tabs, **Then** the corresponding Mermaid diagram renders.

---

### User Story 4 — Inspect Node Details (Priority: P2)

As a developer, when I click a node in the diagram, I want to see detailed information about that code element in an inspector panel so that I can understand what that part of the code does.

**Why this priority**: Node inspection bridges the gap between visual diagram and actual code. Without it, the diagram is just a picture.

**Independent Test**: Open a flow diagram. Click on any node. Verify the inspector panel appears on the right showing: node name, type, file path, line range, code snippet, and incoming/outgoing relations.

**Acceptance Scenarios**:

1. **Given** a diagram is displayed, **When** the user clicks a node, **Then** the inspector panel on the right shows: node label, type (ui/controller/service/repository/etc.), file path, line start, line end, description, incoming relations, and outgoing relations.
2. **Given** a node is selected, **When** the inspector shows the node detail, **Then** a code snippet from the referenced file and line range is displayed.
3. **Given** a node has no file mapping, **When** the user clicks it, **Then** the inspector shows: "This node does not have source code mapping yet."
4. **Given** the inspector is open, **When** the user clicks another node, **Then** the inspector updates to show the new node's details.

---

### User Story 5 — Navigate to Source Code (Priority: P3)

As a developer, from the inspector panel, I want to open the actual source file and highlight the relevant code lines so that I can jump directly from the diagram to the code.

**Why this priority**: Source navigation completes the loop from diagram → code. It's the final piece that makes Flow Pilot a true code understanding tool.

**Independent Test**: Click a node with file mapping. In the inspector, click "Open File". Verify the file opens in VS Code at the correct line. Click "Highlight Code". Verify the line range is highlighted in the editor.

**Acceptance Scenarios**:

1. **Given** the inspector shows a node with file mapping, **When** the user clicks "Open File", **Then** the source file opens in the VS Code editor scrolled to the relevant line range.
2. **Given** the inspector shows a node with file mapping, **When** the user clicks "Highlight Code", **Then** the file opens and the line range (lineStart to lineEnd) is highlighted with a selection in the editor.
3. **Given** the referenced file has been moved or deleted, **When** the user clicks "Open File", **Then** a message appears: "File not found. It may have been moved or deleted."

---

### User Story 6 — Export Flow Data (Priority: P3)

As a developer, I want to export a generated flow as Mermaid source or JSON so that I can include it in documentation, share it with teammates, or use it outside the extension.

**Why this priority**: Export enables sharing and documentation workflows. Nice-to-have but not critical for core value.

**Independent Test**: Open a flow from history. Select "Export Mermaid". Verify a `.md` file with Mermaid source is saved. Select "Export JSON". Verify a `.json` file with full flow data is saved.

**Acceptance Scenarios**:

1. **Given** a flow is open in the viewer, **When** the user selects "Export Mermaid", **Then** the Mermaid diagram source is saved to a file.
2. **Given** a flow is open in the viewer, **When** the user selects "Export JSON", **Then** the full flow data (nodes, edges, metadata) is saved as JSON.

---

### Edge Cases

- What happens when the workspace has no code files? → Show clear error: "No workspace folder opened. Please open a project first."
- What happens when the Mermaid syntax is invalid? → Show raw Mermaid source with error message and allow copying.
- What happens when the history JSON file is corrupt? → Create backup of corrupt file, start fresh history, notify user.
- What happens when a diagram has too many nodes? → Hard cap at 50 nodes. If analysis produces more, reject with message: "Flow too large (X nodes found). Please narrow your prompt to focus on a specific part of the codebase."
- What happens when the user tries to pan and click at the same time? → Short drag = click, long drag = pan (threshold-based disambiguation).
- What happens when the MCP server is unreachable? → Show connection error with retry option.
- What happens when the AI cannot determine the diagram type? → Default to flowchart and note the choice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a History page as the first screen when the extension opens.
- **FR-002**: System MUST show an empty state message when no flows have been generated.
- **FR-003**: System MUST provide an MCP tool named `generate_flow` that accepts a single required parameter: `prompt` (string, natural language description of the desired code flow). All other behavior (diagram type selection, analysis depth, error path inclusion, history saving) MUST be determined automatically by the AI with sensible defaults.
- **FR-004**: System MUST scan the current workspace codebase to find files, functions, classes, and call relationships relevant to the user's prompt. The system MUST be language-agnostic — it works on any codebase the AI can read (JS/TS, Python, Dart, Java, Kotlin, Swift, Go, C#, Rust, etc.).
- **FR-005**: System MUST generate Mermaid flowchart syntax from analyzed code relationships.
- **FR-006**: System MUST generate Mermaid sequence diagram syntax when the flow involves component communication.
- **FR-007**: System MUST render Mermaid diagrams as SVG inside a VS Code Webview.
- **FR-008**: System MUST support zoom in/out (25%-300% range) via mouse wheel, pinch, and toolbar buttons.
- **FR-009**: System MUST support pan/drag to navigate diagrams larger than the viewport.
- **FR-010**: System MUST provide toolbar controls: zoom in, zoom out, fit to screen, reset zoom.
- **FR-011**: System MUST make diagram nodes clickable with stable IDs linked to source metadata.
- **FR-012**: System MUST display an inspector panel when a node is clicked, showing: node name, type, file path, line range, code snippet, incoming/outgoing relations.
- **FR-013**: System MUST provide an "Open File" action in the inspector that opens the source file in VS Code editor at the relevant line.
- **FR-014**: System MUST provide a "Highlight Code" action in the inspector that opens the file and highlights the line range.
- **FR-015**: System MUST automatically save every generated flow to history (success or partial).
- **FR-016**: System MUST persist history as JSON in `.vscode/flow-pilot/` directory.
- **FR-017**: System MUST allow users to rename and delete flows from history.
- **FR-018**: System MUST support both Flowchart and Sequence diagram types with a switcher in the viewer.
- **FR-019**: System MUST display loading/progress state during flow generation with step-by-step status.
- **FR-020**: System MUST handle partial results gracefully, saving with status "partial".
- **FR-021**: System MUST display clear error messages for all failure modes (no workspace, no files found, Mermaid error, corrupt history, file not found).
- **FR-022**: System MUST use VS Code CSS variables for all UI styling (no hardcoded colors).
- **FR-023**: System MUST support both dark and light VS Code themes.
- **FR-024**: System MUST allow exporting flows as Mermaid source and as JSON.
- **FR-025**: System MUST validate all data before storage (flowId, title, Mermaid syntax, nodes, edges, line ranges).
- **FR-028**: System MUST enforce a hard cap of 50 nodes per diagram. If analysis produces more, the system MUST reject with a clear message asking the user to narrow their prompt.
- **FR-026**: System MUST handle corrupt history files by creating a backup and starting fresh.
- **FR-027**: System MUST show a "Copy Prompt" action for each history item.

### Key Entities

- **Flow**: Represents a generated code flow visualization. Key attributes: id, title, description, requestPrompt, status (success/failed/partial), createdAt, updatedAt, diagramTypes, nodes, edges, sourceFiles.
- **Node**: Represents a code element in the flow. Key attributes: id, label, type (ui/controller/service/repository/etc.), file path, lineStart, lineEnd, description.
- **Edge**: Represents a relationship between nodes. Key attributes: from (node id), to (node id), label.
- **History Entry**: Index record for a flow. Key attributes: flowId, title, description, createdAt, updatedAt, status, diagramTypes, nodeCount, edgeCount, sourceFileCount.
- **Diagram**: Mermaid source representation. Key attributes: type (flowchart/sequence), mermaidSource.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate their first code flow diagram within 60 seconds of opening the extension with a workspace.
- **SC-002**: Generated diagrams accurately reflect actual code relationships with clickable nodes that link to correct source files and line ranges.
- **SC-003**: Diagram interaction (zoom, pan, click) responds within 100ms for diagrams with up to 50 nodes.
- **SC-004**: The extension supports both dark and light VS Code themes with no visual regressions.
- **SC-005**: All generated flows are persisted and retrievable from history across VS Code sessions.
- **SC-006**: Error states provide clear, actionable messages — zero unhandled crashes.
- **SC-007**: Users can navigate from diagram node to source code in under 3 seconds (click node → click Open File → editor focused on code).

## Assumptions

- Users have a VS Code workspace open with source code when using Flow Pilot.
- The MCP server (AI backend) is available and reachable during flow generation.
- Users are familiar with basic VS Code extension usage (sidebar, panels, webview).
- Mermaid.js can render diagrams up to 50 nodes inside a VS Code Webview (hard cap enforced by the system).
- The AI can perform meaningful codebase analysis by reading file contents and identifying call relationships.
- Flow Pilot targets VS Code version 1.80+ for Webview API compatibility.
- The `.vscode/flow-pilot/` directory is writable in the workspace.
- History storage is workspace-scoped (each workspace has its own flow history).

## Clarifications

### Session 2026-05-31

- Q: What is the MCP `generate_flow` input schema? → A: Minimal — single required parameter `prompt` (string). All other behavior (diagram type, depth, error paths, history save) determined automatically by AI with sensible defaults.
- Q: What is the maximum number of nodes allowed in a diagram? → A: Hard cap at 50 nodes. If exceeded, reject with message asking user to narrow their prompt. Keeps diagrams readable and implementation simple.
- Q: What programming languages/frameworks does the codebase scanner support? → A: Language-agnostic. Works on any codebase the AI can read. No language-specific parsers needed.
