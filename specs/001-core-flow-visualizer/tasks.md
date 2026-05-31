# Tasks: Flow Pilot — AI-Powered Code Flow Visualizer

**Input**: Design documents from `/specs/001-core-flow-visualizer/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/mcp-generate-flow.md ✅

**Tests**: Test tasks included per constitution principle III (Defensive Engineering).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5, US6)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize TypeScript VS Code extension project with `package.json` including dependencies (`@types/vscode`, `mermaid`, `@modelcontextprotocol/sdk`, `uuid`) and scripts (`compile`, `watch`, `test`, `package`) at root
- [x] T002 Create `tsconfig.json` configured for VS Code extension (target: ES2022, module: Node16, strict: true, outDir: out/) at root
- [x] T003 [P] Create `.vscodeignore` excluding node_modules, src/, tests/, tsconfig.json, .specify/, specs/ from VSIX package at root
- [x] T004 [P] Create project directory structure per plan.md: `src/commands/`, `src/mcp/`, `src/storage/`, `src/webview/`, `src/types/`, `webview/history/`, `webview/viewer/`, `webview/shared/`, `tests/unit/`, `tests/integration/`, `tests/contract/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Create TypeScript interfaces for Flow, Node, Edge, SourceFile, Diagram, and HistoryEntry in `src/types/flow.ts` and `src/types/history.ts` per data-model.md entity definitions (including all fields, types, required/optional markers)
- [x] T006 [P] Create Node type enum values (`ui`, `controller`, `service`, `repository`, `model`, `api`, `sdk`, `external`, `unknown`) and Flow status enum (`success`, `failed`, `partial`) in `src/types/flow.ts`
- [x] T007 Implement data validation module in `src/storage/validation.ts` with functions: `validateFlow(flow)`, `validateNode(node)`, `validateEdge(edge, nodeIds)`, `validateHistoryEntry(entry)` — enforces all rules from data-model.md (UUID format, non-empty strings, max lengths, lineStart <= lineEnd, node limit 50, edge references valid nodes, no self-loops)
- [x] T008 Implement history storage in `src/storage/historyStorage.ts` with functions: `getHistoryIndex(workspacePath)` → reads `.vscode/flow-pilot/history.json`, `addHistoryEntry(workspacePath, entry)`, `updateHistoryEntry(workspacePath, flowId, updates)`, `deleteHistoryEntry(workspacePath, flowId)` — handles missing file (create empty), corrupt JSON (backup + recreate), version field
- [x] T009 Implement flow storage in `src/storage/flowStorage.ts` with functions: `saveFlow(workspacePath, flow)` → writes to `.vscode/flow-pilot/flows/{flowId}.json`, `loadFlow(workspacePath, flowId)` → reads flow JSON, `deleteFlow(workspacePath, flowId)`, `flowExists(workspacePath, flowId)` — validates before write using validation.ts
- [x] T010 Create extension entry point in `src/extension.ts` with `activate(context)` function that: registers commands (stubs), sets up storage path resolution using `vscode.workspace.workspaceFolders`, and `deactivate()` cleanup function
- [x] T011 Register extension commands in `package.json` `contributes` section: `flowpilot.openHistory` (title: "Flow Pilot: Open History"), `flowpilot.openFlow` (title: "Flow Pilot: Open Flow"), `flowpilot.highlightCode` (title: "Flow Pilot: Highlight Code") — with activation events `onView:flowpilot.history`

**Checkpoint**: Foundation ready — storage, types, validation, and extension shell all functional. User story implementation can now begin.

---

## Phase 3: User Story 1 — View Flow History (Priority: P1) 🎯 MVP

**Goal**: User opens Flow Pilot and sees history list (or empty state). Can open, rename, delete flows.

**Independent Test**: Open extension panel → see empty state. Generate a flow manually (test fixture). Reopen → see flow in list. Click → opens viewer. Delete → removed from list.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Unit test for historyStorage: add entry, read back, update title, delete entry, handle corrupt file in `tests/unit/storage/historyStorage.test.ts`
- [ ] T013 [P] [US1] Unit test for flowStorage: save flow, load flow, delete flow, validate before write in `tests/unit/storage/flowStorage.test.ts`
- [ ] T014 [P] [US1] Unit test for validation: valid flow passes, invalid flow rejected (missing title, empty nodes, lineStart > lineEnd, >50 nodes, self-loop edge) in `tests/unit/storage/validation.test.ts`

### Implementation for User Story 1

- [ ] T012 [P] [US1] Unit test for historyStorage: add entry, read back, update title, delete entry, handle corrupt file in `tests/unit/storage/historyStorage.test.ts`
- [ ] T013 [P] [US1] Unit test for flowStorage: save flow, load flow, delete flow, validate before write in `tests/unit/storage/flowStorage.test.ts`
- [ ] T014 [P] [US1] Unit test for validation: valid flow passes, invalid flow rejected (missing title, empty nodes, lineStart > lineEnd, >50 nodes, self-loop edge) in `tests/unit/storage/validation.test.ts`

### Implementation for User Story 1

- [x] T015 [P] [US1] Create history page HTML in `webview/history/index.html` with: container for history list, empty state message div, flow item template (title, description, date, diagram type, node count, status badge), action buttons (open, rename, delete, copy prompt)
- [x] T016 [P] [US1] Create history page styles in `webview/history/history.css` using only VS Code CSS variables (`--vscode-editor-background`, `--vscode-foreground`, `--vscode-list-hoverBackground`, `--vscode-list-activeSelectionBackground`, `--vscode-button-background`, `--vscode-descriptionForeground`, `--vscode-errorForeground`) — flat design, thin borders, clear hover/active states
- [x] T017 [US1] Create history page JavaScript in `webview/history/history.js` that: receives `historyLoaded` message with entries array, renders list or empty state, handles button clicks (open, rename, delete, copy prompt) by posting messages back to extension host
- [x] T018 [US1] Implement Webview HTML generator in `src/webview/webviewHtml.ts` with function `getHistoryWebviewHtml(webview, extensionUri)` that returns full HTML document with CSP headers (`script-src ${webview.cspSource}`, `style-src ${webview.cspSource} 'unsafe-inline'`), loads history.js and history.css via webview URIs
- [x] T019 [US1] Implement history view provider in `src/webview/historyViewProvider.ts` implementing `vscode.WebviewViewProvider` with `resolveWebviewView()`: sets webview options (enableScripts, retainContextWhenHidden), loads history from storage, sends `historyLoaded` message, handles incoming messages (openFlow, deleteFlow, renameFlow, copyPrompt)
- [x] T020 [US1] Implement message handler in `src/webview/messageHandler.ts` with function `handleWebviewMessage(message, context)` that routes message types: `openFlow` → opens flow viewer, `deleteFlow` → confirms + deletes from storage, `renameFlow` → updates title in storage, `copyPrompt` → copies to clipboard
- [x] T021 [US1] Implement open history command in `src/commands/openHistoryCommand.ts` that registers the WebviewViewProvider for `flowpilot.history` view and opens the sidebar panel
- [x] T022 [US1] Wire history view into `src/extension.ts` activate(): register HistoryViewProvider with `vscode.window.registerWebviewViewProvider('flowpilot.history', provider)`, pass storage context

**Checkpoint**: User Story 1 fully functional — history panel shows flows, empty state works, open/rename/delete actions work.

---

## Phase 4: User Story 2 — Generate Code Flow via MCP (Priority: P1) 🎯 MVP

**Goal**: User invokes `generate_flow` MCP tool with natural language prompt. AI scans workspace, generates Mermaid flowchart, saves to history.

**Independent Test**: Invoke `generate_flow` with a test workspace. Verify: relevant files found, nodes/edges generated, Mermaid flowchart valid, flow saved to history, appears in history panel.

### Tests for User Story 2

- [ ] T023 [P] [US2] Unit test for flowBuilder: converts raw node/edge arrays into valid Flow object with generated ID, timestamps, validation in `tests/unit/mcp/flowBuilder.test.ts`
- [ ] T024 [P] [US2] Unit test for mermaidBuilder: converts nodes/edges to valid Mermaid flowchart syntax, handles empty edges, handles single node, handles 50-node cap in `tests/unit/mcp/mermaidBuilder.test.ts`
- [ ] T025 [P] [US2] Contract test for generate_flow tool: validates input schema (prompt required, non-empty), validates output schema (flowId, title, status, summary, historySaved), tests error responses (NO_WORKSPACE, EMPTY_PROMPT, NO_RELEVANT_FILES, NODE_LIMIT_EXCEEDED) in `tests/contract/generate-flow.test.ts`

### Implementation for User Story 2

- [ ] T023 [P] [US2] Unit test for flowBuilder: converts raw node/edge arrays into valid Flow object with generated ID, timestamps, validation in `tests/unit/mcp/flowBuilder.test.ts`
- [ ] T024 [P] [US2] Unit test for mermaidBuilder: converts nodes/edges to valid Mermaid flowchart syntax, handles empty edges, handles single node, handles 50-node cap in `tests/unit/mcp/mermaidBuilder.test.ts`
- [ ] T025 [P] [US2] Contract test for generate_flow tool: validates input schema (prompt required, non-empty), validates output schema (flowId, title, status, summary, historySaved), tests error responses (NO_WORKSPACE, EMPTY_PROMPT, NO_RELEVANT_FILES, NODE_LIMIT_EXCEEDED) in `tests/contract/generate-flow.test.ts`

### Implementation for User Story 2

- [x] T026 [P] [US2] Implement codebase scanner in `src/mcp/codebaseScanner.ts` with function `scanWorkspace(prompt, workspacePath)` that: extracts keywords from prompt, uses `vscode.workspace.findFiles()` to discover files matching keywords, reads file contents via `vscode.workspace.openTextDocument()`, returns array of `{ path, content, reason }` — returns empty array with error code if no workspace or no files found
- [x] T027 [US2] Implement flow builder in `src/mcp/flowBuilder.ts` with function `buildFlow(rawNodes, rawEdges, prompt, sourceFiles)` that: generates UUID for flow.id, creates title from prompt (first 100 chars), validates node count ≤ 50 (rejects with NODE_LIMIT_EXCEEDED), validates all edge references exist in nodes, creates Diagram objects, builds HistoryEntry, returns complete Flow object
- [x] T028 [US2] Implement mermaid builder in `src/mcp/mermaidBuilder.ts` with function `buildMermaidFlowchart(nodes, edges)` that: generates `flowchart TD` syntax, maps each node to `id["label"]` with shape based on type (rect for ui/controller, rounded for service, stadium for api, cylinder for repository), maps each edge to `from -->|label| to`, returns mermaid source string. Also implement `buildMermaidSequence(nodes, edges)` for sequence diagram syntax.
- [x] T029 [US2] Implement MCP server setup in `src/mcp/server.ts` with function `createMcpServer()` that: creates MCP server instance using `@modelcontextprotocol/sdk`, registers the `generate_flow` tool with input schema `{ prompt: string }`, returns server instance ready for transport connection
- [x] T030 [US2] Implement generate_flow tool in `src/mcp/generateFlowTool.ts` with function `generateFlowHandler(args, workspacePath)` that: validates prompt (non-empty, max 2000 chars), calls codebaseScanner, calls flowBuilder, calls mermaidBuilder, saves flow via flowStorage, updates history via historyStorage, returns success/partial/error response per contract — sends progress messages if webview is active
- [ ] T031 [US2] Wire MCP server into extension activation in `src/extension.ts`: create MCP server on activate, connect stdio transport, register dispose on deactivate
- [ ] T032 [US2] Connect MCP output to history panel: after flow saved, send `historyUpdated` message to history webview to refresh list automatically

**Checkpoint**: User Story 2 fully functional — MCP tool generates flows, saves to history, appears in history panel.

---

## Phase 5: User Story 3 — View Interactive Diagram (Priority: P2)

**Goal**: User opens a flow from history and sees an interactive Mermaid diagram with zoom, pan, fit, reset controls, and diagram type switcher.

**Independent Test**: Open a saved flow → diagram renders as SVG. Mouse wheel zooms. Drag pans. Toolbar buttons work. Switch between flowchart/sequence tabs.

### Tests for User Story 3

- [ ] T033 [P] [US3] Integration test: extension activation loads, commands registered, webview providers registered in `tests/integration/extension.test.ts`

### Implementation for User Story 3

- [x] T034 [P] [US3] Create Mermaid initialization script in `webview/shared/mermaid-init.js` that: loads Mermaid.js, configures `mermaid.initialize()` with theme variables from VS Code CSS (reads `getComputedStyle` for colors), sets `startOnLoad: false`, exposes `renderDiagram(id, source)` function that calls `mermaid.render()` and returns SVG string
- [x] T035 [P] [US3] Create shared theme CSS in `webview/shared/theme.css` that maps VS Code CSS variables to Mermaid theme variables: `--vscode-editor-background` → background, `--vscode-foreground` → text, `--vscode-button-background` → primary color, etc.
- [x] T036 [US3] Create flow viewer HTML in `webview/viewer/index.html` with: header (title, description), toolbar (zoom -, zoom %, zoom +, fit, reset, export buttons), diagram type tabs (Flowchart | Sequence), diagram container div, inspector panel div (initially hidden), loads viewer.js, viewer.css, mermaid-init.js, theme.css
- [x] T037 [US3] Create flow viewer styles in `webview/viewer/viewer.css` using only VS Code CSS variables — layout: header + toolbar at top, diagram area fills remaining space, inspector panel slides in from right (300px width), toolbar buttons styled as VS Code buttons, diagram container has `overflow: hidden` with `cursor: grab`/`grabbing`
- [x] T038 [US3] Create flow viewer JavaScript in `webview/viewer/viewer.js` implementing:
  - Receive `flowLoaded` message → store flow data, render initial diagram (flowchart)
  - Diagram type tab switching → re-render with selected diagram type
  - Zoom: mouse wheel listener → `scale` state (0.25–3.0), apply `transform: scale()` to diagram container
  - Zoom buttons: `-` decrease 10%, `+` increase 10%, `fit` calculate scale to fill viewport, `reset` set to 1.0
  - Pan: pointer down → track start position, pointer move → apply `translate()`, pointer up → end drag
  - Interaction disambiguation: pointer move < 5px threshold = click, ≥ 5px = pan
  - Display zoom percentage in toolbar
- [x] T039 [US3] Implement flow viewer provider in `src/webview/flowViewerProvider.ts` with function `createFlowViewerPanel(flowId, flowData)` that: creates `vscode.WebviewPanel` with `ViewColumn.One`, sets webview HTML using webviewHtml.ts, sends `flowLoaded` message with full flow data, handles incoming messages (nodeClick, openFile, highlightCode, export)
- [x] T040 [US3] Implement open flow command in `src/commands/openFlowCommand.ts` that: loads flow from storage by ID, creates flow viewer panel, handles errors (flow not found → show error message)

**Checkpoint**: User Story 3 fully functional — diagrams render, zoom/pan/fit/reset work, diagram type switching works.

---

## Phase 6: User Story 4 — Inspect Node Details (Priority: P2)

**Goal**: User clicks a node in the diagram and sees an inspector panel with node details, code snippet, and action buttons.

**Independent Test**: Click a node → inspector panel appears on right with label, type, file path, line range, code snippet, incoming/outgoing edges. Click another node → inspector updates. Click node with no file mapping → shows "no mapping" message.

### Implementation for User Story 4

- [x] T041 [US4] Implement node click handling in `webview/viewer/viewer.js`: add event listener on diagram container using event delegation — find closest `[data-id]` attribute on SVG `<g>` elements, extract node ID, post `nodeClick` message to extension host with nodeId
- [x] T042 [US4] Implement inspector panel rendering in `webview/viewer/viewer.js`: receive `nodeDetail` message from extension, populate inspector div with: node label, type badge, file path (if available), line range (if available), code snippet (if available), incoming edges list, outgoing edges list, "Open File" button (if file mapping exists), "Highlight Code" button (if file mapping exists), "No source mapping" message (if no file)
- [x] T043 [US4] Implement node detail resolution in `src/webview/flowViewerProvider.ts`: on `nodeClick` message, look up node by ID in stored flow data, read code snippet from source file (read lines lineStart–lineEnd), build incoming/outgoing edge lists, send `nodeDetail` message to webview with full node context
- [x] T044 [US4] Implement inspector panel styles in `webview/viewer/viewer.css`: panel slides in from right when active, shows node type as colored badge, code snippet in monospace pre/code block, action buttons styled as VS Code buttons, transitions for open/close

**Checkpoint**: User Story 4 fully functional — clicking nodes shows inspector with full details and code snippets.

---

## Phase 7: User Story 5 — Navigate to Source Code (Priority: P3)

**Goal**: User clicks "Open File" or "Highlight Code" in inspector to jump to source code in VS Code editor.

**Independent Test**: Click node with file mapping. Click "Open File" → file opens at correct line. Click "Highlight Code" → file opens with line range highlighted. Click node with deleted file → shows "file not found" message.

### Implementation for User Story 5

- [x] T045 [US5] Implement highlight code command in `src/commands/highlightCodeCommand.ts` with function `openAndHighlight(filePath, lineStart, lineEnd)`: resolves file path relative to workspace, opens document via `vscode.workspace.openTextDocument()`, shows document in editor via `vscode.window.showTextDocument()`, creates selection range from lineStart to lineEnd, sets `editor.selection`, scrolls to selection via `editor.revealRange()` — handles file not found with error message
- [x] T046 [US5] Wire Open File button in `src/webview/flowViewerProvider.ts`: on `openFile` message from webview, resolve file path, open in editor at lineStart via `vscode.window.showTextDocument()` with `{ selection: new Range(lineStart-1, 0, lineEnd-1, 0) }` — handle file not found: send `errorMessage` to webview
- [x] T047 [US5] Wire Highlight Code button in `src/webview/flowViewerProvider.ts`: on `highlightCode` message, call `highlightCodeInEditor()` — handle file not found with error message
- [x] T048 [US5] Implement error message display in `webview/viewer/viewer.js`: receive `errorMessage` message, show toast/banner in viewer with error text and "File not found. It may have been moved or deleted." message

**Checkpoint**: User Story 5 fully functional — clicking Open File and Highlight Code navigates to source code.

---

## Phase 8: User Story 6 — Export Flow Data (Priority: P3)

**Goal**: User can export a flow as Mermaid source or JSON file.

**Independent Test**: Open a flow. Click "Export Mermaid" → .md file saved with Mermaid source. Click "Export JSON" → .json file saved with full flow data.

### Implementation for User Story 6

- [x] T049 [US6] Implement export Mermaid in `src/webview/flowViewerProvider.ts`: on `exportMermaid` message, combine all diagram sources into a single markdown string, use `vscode.window.showSaveDialog()` to let user choose save location (default: `{flowTitle}.md`), write file
- [x] T050 [US6] Implement export JSON in `src/webview/flowViewerProvider.ts`: on `exportJson` message, serialize full flow data as formatted JSON, use `vscode.window.showSaveDialog()` (default: `{flowTitle}.json`), write file
- [x] T051 [US6] Wire export buttons in `webview/viewer/viewer.js`: Export Mermaid button → post `exportMermaid` message, Export JSON button → post `exportJson` message

**Checkpoint**: User Story 6 fully functional — flows can be exported as Mermaid or JSON.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements that affect multiple user stories

- [x] T052 [P] Implement delete flow with confirmation dialog in `src/webview/historyViewProvider.ts`: show `vscode.window.showWarningMessage()` with "Delete" and "Cancel" buttons before deleting
- [ ] T053 [P] Implement rename flow inline editing in `webview/history/history.js`: click title → contenteditable input, blur/enter → save new title via message
- [x] T054 [P] Implement Copy Prompt action in `src/webview/historyViewProvider.ts`: on `copyPrompt` message, copy requestPrompt to clipboard via `vscode.env.clipboard.writeText()`, show info message "Prompt copied to clipboard"
- [x] T055 [P] Implement corrupt history recovery in `src/storage/historyStorage.ts`: if JSON.parse fails, rename corrupt file to `history.json.corrupt.{timestamp}`, create fresh history.json, return empty index with warning logged
- [x] T056 [P] Implement loading/progress state in `webview/viewer/viewer.js`: receive `generationProgress` message, show progress bar and step text (understanding → searching → reading → building → generating → saving), hide when `flowLoaded` received
- [ ] T057 Implement generation progress reporting in `src/mcp/generateFlowTool.ts`: send `generationProgress` messages at each pipeline step with percentage (0%, 20%, 40%, 60%, 80%, 100%) to active webview if open
- [ ] T058 Implement partial result display in `webview/viewer/viewer.js`: if flow status is "partial", show banner: "Partial Flow Generated — some parts could not be found" with list of missing items from warnings array
- [ ] T059 Implement failed flow error display in `webview/viewer/viewer.js`: if flow status is "failed", show error message with suggestion from error response, allow copying the original prompt
- [ ] T060 Verify VS Code theme compliance: test extension in both dark and light themes, verify all colors use CSS variables, verify no hardcoded colors in any CSS file, verify hover/active/focus states are visible in both themes
- [ ] T061 [P] Write integration test for full extension lifecycle: activate → register commands → open history → load fixture flow → open viewer → verify webview renders in `tests/integration/extension.test.ts`
- [ ] T062 [P] Write integration test for MCP server: create server → invoke generate_flow with fixture workspace → verify output schema → verify flow saved to disk in `tests/integration/mcp-server.test.ts`
- [ ] T063 Run quickstart.md validation: follow all steps in quickstart.md, verify each step works end-to-end, fix any issues found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1: View History (Phase 3)**: Depends on Foundational (Phase 2)
- **US2: Generate Flow (Phase 4)**: Depends on Foundational (Phase 2) — can run parallel with US1
- **US3: Interactive Diagram (Phase 5)**: Depends on US1 (needs flow viewer entry point from history)
- **US4: Inspect Nodes (Phase 6)**: Depends on US3 (needs diagram rendered with SVG nodes)
- **US5: Source Navigation (Phase 7)**: Depends on US4 (needs inspector panel with action buttons)
- **US6: Export Data (Phase 8)**: Depends on US3 (needs flow viewer with export buttons)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P1)**: Can start after Foundational — no dependencies on other stories (parallel with US1)
- **US3 (P2)**: Depends on US1 (history opens viewer)
- **US4 (P2)**: Depends on US3 (diagram must render before nodes are clickable)
- **US5 (P3)**: Depends on US4 (inspector must show before actions work)
- **US6 (P3)**: Depends on US3 (viewer must exist before export works) — parallel with US4/US5

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before storage
- Storage before services
- Services before UI
- UI before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005, T006 can all run in parallel (Setup + types)
- T012, T013, T014 can all run in parallel (US1 tests)
- T015, T016 can run in parallel (US1 HTML + CSS)
- T023, T024, T025 can all run in parallel (US2 tests)
- T026 can run parallel with T027, T028 (scanner vs builders)
- T034, T035 can run in parallel (mermaid init + theme CSS)
- US1 and US2 can be implemented in parallel after Foundational
- US4 and US6 can be implemented in parallel after US3

---

## Parallel Example: After Foundational Phase

```bash
# Launch US1 and US2 in parallel:
Task: "T012-T022: Implement History page (US1)"
Task: "T023-T032: Implement MCP generate_flow (US2)"

# Within US2, launch tests and scanner in parallel:
Task: "T023: Unit test flowBuilder"
Task: "T024: Unit test mermaidBuilder"
Task: "T025: Contract test generate_flow"
Task: "T026: Implement codebaseScanner"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T011)
3. Complete Phase 3: View History (T012-T022)
4. Complete Phase 4: Generate Flow (T023-T032)
5. **STOP and VALIDATE**: Open extension → see empty state → generate flow via MCP → see it in history → open it
6. This is the MVP — deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (History) + US2 (Generate Flow) → Test → **MVP!**
3. Add US3 (Interactive Diagram) → Test → Diagrams render with zoom/pan
4. Add US4 (Inspect Nodes) → Test → Click nodes to see details
5. Add US5 (Source Navigation) → Test → Jump to code from diagram
6. Add US6 (Export) → Test → Export Mermaid/JSON
7. Polish → Final quality pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All CSS MUST use VS Code CSS variables — no hardcoded colors (Constitution Principle I)
- All error paths MUST be handled — never crash (Constitution Principle III)
- Node limit is 50 — validate in flowBuilder (Constitution Principle VII)
