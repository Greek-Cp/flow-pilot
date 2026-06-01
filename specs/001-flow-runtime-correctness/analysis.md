# Analysis: Spec, Plan, Tasks, Contracts, Constitution Consistency

**Date**: 2026-06-01

## Consistency Checks

- Constitution requires existing-project audit: satisfied by `research.md` and `plan.md` referencing real files.
- Constitution requires spec source of truth: satisfied by `spec.md`, `plan.md`, `tasks.md`, and contracts before implementation.
- Traceable node contract: satisfied by `data-model.md` and MCP contracts defining source metadata, evidence, reason, and confidence.
- Interactive canvas correctness: satisfied by P1 user stories, FR-001 through FR-008, and quickstart manual checks.
- MCP stability: satisfied by keeping `generate_flow` schema version 1 and adding optional fields plus new detail tools.
- Evidence-based analysis: satisfied by requiring source-backed evidence and explicitly marking conceptual nodes.
- Maintainability: satisfied by adding scoped helper modules and avoiding large unrelated rewrites.
- Testability: satisfied by compile/test tasks and measurable success criteria.

## Ambiguities Resolved

- "Zoom should focus on center or pointer": pointer focus is used for wheel zoom; viewport center is used for toolbar zoom.
- "Mouse or Mac touchpad move": normal wheel/touchpad scroll is treated as pan; modified/pinch wheel is treated as zoom.
- "Jump to code on node click": only source-backed nodes open files; conceptual nodes inspect only.
- "MCP detail improvement": implemented as additive node/edge metadata plus `get_node_detail` and `get_relationship_detail`.

## Open Risks

- Pinch wheel modifier behavior can vary by VS Code/webview platform; toolbar zoom remains deterministic.
- Symbol extraction is heuristic in this feature, not full language-server semantic analysis.
- Existing saved flows without metadata will return derived/default detail rather than full evidence.
