# Data Model: Flow Runtime Correctness And Traceable MCP Details

## Node

Represents a code element or conceptual element in a generated flow.

Required fields:

- `id`: unique string within the flow.
- `label`: display label.
- `type`: one of `file`, `function`, `class`, `method`, `module`, `ui`, `controller`, `service`, `repository`, `datasource`, `model`, `api`, `sdk`, `external`, `unknown`.
- `file`: relative path or null.
- `lineStart`: 1-based start line or null.
- `lineEnd`: 1-based end line or null.

Optional fields:

- `symbolName`: symbol/function/class name when known.
- `description`: concise explanation.
- `reason`: why this node was included in the flow.
- `confidence`: number from 0 to 1.
- `evidence`: array of evidence records.

Validation rules:

- If `file` is set, `lineStart` and `lineEnd` must be set.
- `lineStart` must be less than or equal to `lineEnd`.
- `confidence`, when present, must be between 0 and 1.
- Older nodes without optional metadata remain valid.

## Edge

Represents a directional relationship between two nodes.

Required fields:

- `from`: source node id.
- `to`: target node id.

Optional fields:

- `label`: display relationship label.
- `reason`: why this relationship exists.
- `confidence`: number from 0 to 1.
- `evidence`: array of evidence records.

Validation rules:

- `from` and `to` must reference existing node ids.
- Self-loops are not allowed.
- `confidence`, when present, must be between 0 and 1.

## Evidence

Represents proof or rationale for a node or relationship.

Fields:

- `kind`: `file`, `symbol`, `snippet`, `filename`, `prompt`, or `relationship`.
- `file`: relative source path when available.
- `lineStart`: 1-based start line when available.
- `lineEnd`: 1-based end line when available.
- `symbolName`: symbol name when available.
- `snippet`: short source snippet when available.
- `reason`: human-readable explanation.

## MCP Node Detail Response

Fields:

- `schemaVersion`: `1`.
- `type`: `flow-pilot.nodeDetail` or `flow-pilot.error`.
- `flowId`.
- `node`: full node metadata.
- `incoming`: incoming edges with source node summaries.
- `outgoing`: outgoing edges with target node summaries.
- `evidence`: node evidence.
- `codeSnippet`: optional source snippet.
- `error`: stable error object for failures.

## MCP Relationship Detail Response

Fields:

- `schemaVersion`: `1`.
- `type`: `flow-pilot.relationshipDetail` or `flow-pilot.error`.
- `flowId`.
- `relationship`: full edge metadata.
- `fromNode`: source node summary.
- `toNode`: target node summary.
- `evidence`: relationship evidence.
- `error`: stable error object for failures.
