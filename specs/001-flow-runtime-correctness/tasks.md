# Tasks: Flow Runtime Correctness And Traceable MCP Details

**Input**: Design documents from `/specs/001-flow-runtime-correctness/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Include compile verification and focused Vitest coverage for MCP detail helpers.

## Phase 1: Spec Foundation

- [x] T001 Update `.specify/memory/constitution.md` with Flow Pilot project principles.
- [x] T002 Create `specs/001-flow-runtime-correctness/spec.md`.
- [x] T003 Create technical plan, research, data model, quickstart, contracts, and analysis documents.
- [x] T004 Create `specs/001-flow-runtime-correctness/tasks.md`.

## Phase 2: Data Contract Foundation

- [x] T005 [P] Expand `src/types/flow.ts` with optional evidence, reason, confidence, symbol, and richer node types.
- [x] T006 [P] Update `src/storage/validation.ts` to validate new optional metadata and remain compatible with older flows.
- [x] T007 Add metadata helper logic in `src/mcp/flowMetadata.ts`.
- [x] T008 Add MCP detail response helper logic in `src/mcp/detailTools.ts`.

## Phase 3: User Story 1 - Navigate Diagram Naturally (P1)

**Goal**: Wheel/touchpad pans by default; mouse drag pans reliably.

**Independent Test**: Open a flow and verify scroll/drag pan without zoom label changing.

- [x] T009 Update wheel handling in `webview/viewer/viewer.js` so normal wheel/touchpad events pan.
- [x] T010 Update drag handling in `webview/viewer/viewer.js` to preserve node clicks and empty-canvas deselect.

## Phase 4: User Story 2 - Zoom Keeps Focus (P1)

**Goal**: Zoom around pointer or viewport center without jumping top-left.

**Independent Test**: Zoom over a visible node and confirm it remains near the focus point.

- [x] T011 Implement focus-preserving zoom helpers in `webview/viewer/viewer.js`.
- [x] T012 Update toolbar Fit/Reset behavior in `webview/viewer/viewer.js`.

## Phase 5: User Story 3 - Jump From Node To Code (P1)

**Goal**: Source-backed node click opens mapped source; conceptual nodes inspect only.

**Independent Test**: Click one source-backed node and one conceptual node.

- [x] T013 Reuse source-opening helpers in `src/webview/flowViewerProvider.ts`.
- [x] T014 Ensure `webview/viewer/viewer.js` posts node clicks and inspector actions only open code when mapping exists.
- [x] T015 Improve source range selection behavior in `src/commands/highlightCodeCommand.ts`.

## Phase 6: User Story 4 - Rich MCP Details (P2)

**Goal**: Generated flows include metadata, and detail tools return node/relationship evidence.

**Independent Test**: Call `generate_flow`, `get_node_detail`, and `get_relationship_detail`.

- [x] T016 Update `src/mcp/flowBuilder.ts` and `src/mcp/generateFlowTool.ts` to populate optional metadata.
- [x] T017 Register `get_node_detail` and `get_relationship_detail` in `src/mcp/server.ts`.
- [x] T018 Align standalone MCP behavior in `src/mcp/standalone.ts`.
- [x] T019 Add Vitest coverage in `tests/mcp/detailTools.test.ts`.

## Phase 7: Verification And Documentation

- [x] T020 Run `npm run compile`.
- [x] T021 Run `npm run test:unit`.
- [x] T022 Update this task list with completed implementation status.
- [x] T023 Summarize changed files and manual verification guidance.

## Phase 8: User Story 5 - Read The Diagram At A Glance (P1)

**Goal**: Distinguishable node types + legend, click-to-code opens beside (not closing the viewer), and clickable sequence participants.

**Independent Test**: Generate a flow; confirm node shapes, legend, beside-open, and sequence node clicks.

- [x] T024 Encode node types as type-specific Mermaid shapes in `src/mcp/standalone.ts` and `src/mcp/mermaidBuilder.ts`.
- [x] T025 Add `legend` and `readingGuide` to the `generate_flow` response in `src/mcp/standalone.ts`.
- [x] T026 Open/highlight code in `vscode.ViewColumn.Beside` in `src/commands/highlightCodeCommand.ts` so the viewer stays open.
- [x] T027 Hydrate sequence actors/participants for clicks in `webview/viewer/viewer.js` (`hydrateMermaidNodes`).
- [x] T028 Add an always-visible legend to the viewer in `src/webview/webviewHtml.ts`, `webview/viewer/viewer.js`, and `webview/viewer/viewer.css`.
- [x] T029 Recompile and re-run unit tests.

## Dependencies & Execution Order

- Phase 1 blocks all implementation.
- Phase 2 blocks MCP detail work and generated metadata.
- Phases 3 and 4 can be implemented together in `viewer.js`.
- Phase 5 depends on existing node selection and source metadata.
- Phase 6 depends on Phase 2 helpers.
- Phase 7 runs after implementation.

## Parallel Opportunities

- T005 and T006 can run in parallel.
- T009/T010 and T011/T012 touch the same file, so coordinate sequentially.
- T017 and T018 can be done after T008/T016.
