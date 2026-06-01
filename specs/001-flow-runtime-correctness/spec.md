# Feature Specification: Flow Runtime Correctness And Traceable MCP Details

**Feature Branch**: `001-flow-runtime-correctness`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "Perbaiki Spec Driven Development untuk Flow Pilot, bug canvas navigation, zoom behavior, node click jump-to-code, dan tingkatkan detail MCP node/relationship dengan metadata/evidence."

## User Scenarios & Testing

### User Story 1 - Navigate Diagram Naturally (Priority: P1)

As a Flow Pilot user viewing a generated diagram in VS Code, I can pan the canvas with mouse drag or Mac touchpad scrolling without accidentally zooming.

**Why this priority**: Navigation is the first interaction after opening a flow. If scroll pans as zoom, the viewer feels broken.

**Independent Test**: Open any saved flow, use mouse drag and two-finger trackpad scroll. The diagram moves horizontally/vertically and zoom level remains unchanged unless an intentional zoom gesture is used.

**Acceptance Scenarios**:

1. **Given** a flow diagram is open at 100%, **When** the user scrolls horizontally on a Mac touchpad, **Then** the canvas pans left/right and the zoom label remains 100%.
2. **Given** a flow diagram is open, **When** the user drags empty canvas space, **Then** the diagram moves with the pointer and nodes remain clickable after the drag ends.
3. **Given** a flow diagram is open, **When** the user holds a zoom modifier or uses a pinch wheel event, **Then** the diagram zooms intentionally.

---

### User Story 2 - Zoom Keeps Focus (Priority: P1)

As a Flow Pilot user, I can zoom without the diagram jumping to the top-left corner.

**Why this priority**: Zoom that changes focus destroys spatial orientation and makes large diagrams difficult to inspect.

**Independent Test**: Move the pointer over a node near the center/right of the viewport and zoom in/out. The node stays near the pointer or viewport center.

**Acceptance Scenarios**:

1. **Given** the pointer is over a visible node, **When** the user zooms in, **Then** the point under the pointer remains visually stable.
2. **Given** the user clicks zoom-in or zoom-out toolbar buttons, **When** the zoom changes, **Then** the zoom focuses around the visible viewport center.
3. **Given** the user clicks Fit or Reset, **When** the command completes, **Then** the diagram is deliberately centered/fitted rather than accidentally snapped to origin.

---

### User Story 3 - Jump From Node To Code (Priority: P1)

As a developer, I can click a source-backed node and VS Code opens the exact file and line range for that code element.

**Why this priority**: Flow Pilot's core value is connecting visual flow back to real code.

**Independent Test**: Generate or load a flow whose node includes `file`, `lineStart`, and `lineEnd`; click that node; verify VS Code reveals and selects the mapped range.

**Acceptance Scenarios**:

1. **Given** a node has file and line metadata, **When** the user clicks the node, **Then** VS Code opens the relative file and reveals the line range.
2. **Given** a node lacks file metadata, **When** the user clicks the node, **Then** the inspector updates but VS Code does not attempt to open a missing file.
3. **Given** a user clicks "Open Code" in the inspector, **When** the node has source mapping, **Then** the same mapped code range opens.

---

### User Story 4 - Inspect Rich MCP Node Details (Priority: P2)

As an AI client or developer, I can retrieve detailed node and relationship evidence from MCP after generating a flow.

**Why this priority**: MCP output must be useful for downstream AI reasoning and not only for drawing a diagram.

**Independent Test**: Call `generate_flow`, then call `get_node_detail` and `get_relationship_detail` for returned ids. Responses include schema version, node metadata, file location, relationship context, evidence, and confidence.

**Acceptance Scenarios**:

1. **Given** a generated flow exists, **When** `get_node_detail` receives a valid `flowId` and `nodeId`, **Then** it returns node metadata, incoming/outgoing edges, evidence, and optional code snippet.
2. **Given** a generated flow exists, **When** `get_relationship_detail` receives valid `from` and `to`, **Then** it returns the relationship label, connected nodes, rationale/evidence, and confidence.
3. **Given** invalid ids are provided, **When** a detail tool is called, **Then** it returns a versioned error response with a stable code.

### User Story 5 - Read The Diagram At A Glance (Priority: P1)

As a Flow Pilot user looking at a generated diagram, I can immediately tell which node is a screen/page, which is an API, which is a service, and which is a database, and clicking any node (including in the sequence diagram) keeps the diagram open while revealing the code beside it.

**Why this priority**: A diagram is only useful if the reader can interpret it. Users reported that every node looked the same ("which one is the page?"), that clicking a node closed the diagram, and that sequence-diagram nodes were not clickable.

**Independent Test**: Generate any flow. Each node renders with a type-specific shape and icon, a legend explains the icons, clicking a node opens code in a column beside the diagram (the diagram stays open), and sequence participants respond to clicks just like flowchart nodes.

**Acceptance Scenarios**:

1. **Given** a generated flow with UI, API, service, and database nodes, **When** the diagram renders, **Then** each node type uses a visually distinct shape and icon and a legend maps each icon to its meaning.
2. **Given** a source-backed node, **When** the user clicks it or its "Open Code" action, **Then** the code opens in an editor column beside the Flow Viewer and the Flow Viewer remains open.
3. **Given** the sequence diagram tab is active, **When** the user clicks a participant/actor, **Then** the inspector updates and behaves identically to clicking a flowchart node.
4. **Given** the `generate_flow` response, **When** an AI client reads it, **Then** the response contains a legend and a reading guide so the assistant can explain which nodes are screens, APIs, services, and data stores.

---

## Edge Cases

- Trackpad wheel events may include `deltaX`, `deltaY`, `ctrlKey`, or pixel/line/page `deltaMode`; only intentional zoom gestures should change scale.
- Mermaid renders ids differently from Flow Pilot ids; node click resolution must tolerate sanitized ids and labels.
- Mermaid sequence diagrams render actors/participants as `rect.actor`/`text.actor` elements carrying a `name` attribute rather than as `g.node` groups; click hydration must handle both flowchart and sequence structures.
- Opening code from a node must not replace or close the Flow Viewer webview; code opens in a separate editor column beside the diagram.
- Conceptual prompt-only nodes may not have file mappings; click should inspect without opening files.
- A flow may have been saved by an older version without optional metadata; the viewer and detail tools must derive sensible defaults.
- Source files may have moved after generation; opening code should show a VS Code error without breaking the webview.
- Node labels may include a type icon; click resolution must still match the underlying Flow Pilot node id/label.

## Requirements

### Functional Requirements

- **FR-001**: The viewer MUST pan on mouse drag across empty canvas.
- **FR-002**: The viewer MUST pan on normal mouse wheel or touchpad scroll, including horizontal `deltaX`.
- **FR-003**: The viewer MUST zoom only for intentional zoom actions: toolbar buttons, modifier wheel, or pinch-like wheel event.
- **FR-004**: Zoom MUST preserve focus around pointer for wheel zoom and around viewport center for toolbar zoom.
- **FR-005**: Fit MUST calculate scale from the unscaled diagram bounds and center the diagram inside the visible container.
- **FR-006**: Reset MUST set zoom to 100% and place the diagram in a predictable padded origin/center state.
- **FR-007**: Clicking a source-backed node MUST send a node selection message and open/highlight the mapped code range in VS Code.
- **FR-008**: Clicking a non-source-backed node MUST update selection and inspector without opening a file.
- **FR-009**: The Flow node model MUST support optional `symbolName`, `reason`, `confidence`, and `evidence` metadata.
- **FR-010**: Generated source-backed file nodes MUST include file path, line range, symbol name when inferable, reason, confidence, and evidence.
- **FR-011**: The `generate_flow` MCP response MUST remain backward-compatible with existing schema version 1 clients while adding optional richer node metadata.
- **FR-012**: MCP MUST expose `get_node_detail` to retrieve a node, incoming/outgoing relationships, evidence, and source snippet.
- **FR-013**: MCP MUST expose `get_relationship_detail` to retrieve a relationship, endpoint nodes, rationale, evidence, and confidence.
- **FR-014**: Validation MUST accept the richer node types and optional metadata while preserving older flows.
- **FR-015**: The flowchart MUST render each node with a type-specific shape and a type icon so users can distinguish screens/pages, APIs, services, data stores, models, and code/files at a glance.
- **FR-016**: The sequence diagram MUST label participants with a type icon, and its participants/actors MUST be clickable for selection and jump-to-code exactly like flowchart nodes.
- **FR-017**: The viewer MUST display a legend that maps each node-type icon present in the current flow to its meaning.
- **FR-018**: Opening or highlighting source code from a node MUST open the editor in a column beside the Flow Viewer and MUST NOT replace or close the Flow Viewer webview.
- **FR-019**: The `generate_flow` MCP response MUST include a `legend` (type → icon/meaning for the types present) and a human-readable `readingGuide` (including the list of screens/pages) so AI clients can explain the diagram clearly.

### Key Entities

- **Flow**: Persisted generated flow with diagrams, nodes, edges, source files, and warnings.
- **Node**: Flow element with id, label, type, optional source mapping, symbol metadata, reason, confidence, and evidence.
- **Edge**: Directional relationship between nodes with optional label and optional rationale/confidence metadata.
- **Evidence**: Source-backed explanation for why a node or relationship exists.
- **MCP Detail Response**: Versioned response for node/relationship detail tools.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Normal trackpad/mouse wheel pan changes `translateX`/`translateY` without changing zoom.
- **SC-002**: Wheel zoom keeps the diagram coordinate under the pointer within 2 CSS pixels after scale changes.
- **SC-003**: Node click opens the mapped source file and reveals the requested line range when mapping exists.
- **SC-004**: Every generated source-backed node includes file, line range, reason, confidence, and at least one evidence item.
- **SC-005**: `npm run compile` succeeds after implementation.
- **SC-006**: Unit tests for detail extraction and flow metadata pass where practical.
- **SC-007**: Each generated flowchart node renders with a type-specific shape and icon, and the viewer shows a legend covering every node type present.
- **SC-008**: Clicking a source-backed node (in either the flowchart or sequence tab) opens the mapped code in a column beside the diagram while the Flow Viewer stays open.
- **SC-009**: Sequence-diagram participants are selectable and update the inspector the same way flowchart nodes do.

## Assumptions

- VS Code webview wheel events can distinguish pinch/zoom intent through `ctrlKey`/`metaKey`; toolbar zoom remains available if platform events differ.
- Conceptual prompt-only flows remain supported, but are identified by null source mapping and lower confidence.
- Existing `.flow-pilot` storage remains the canonical persistence location, with `.vscode/flow-pilot` retained as legacy fallback.
- The standalone MCP server must keep working without importing VS Code APIs.
