# Data Model: Flow Pilot

**Date**: 2026-05-31
**Feature**: Flow Pilot — AI-Powered Code Flow Visualizer

## Entities

### Flow

The primary entity representing a generated code flow visualization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID) | ✅ | Unique identifier for the flow |
| `title` | `string` | ✅ | Human-readable title (auto-generated or user-renamed) |
| `description` | `string` | ✅ | Brief summary of what the flow represents |
| `requestPrompt` | `string` | ✅ | Original natural language prompt from the user |
| `status` | `enum` | ✅ | One of: `success`, `failed`, `partial` |
| `createdAt` | `string` (ISO 8601) | ✅ | Timestamp of creation |
| `updatedAt` | `string` (ISO 8601) | ✅ | Timestamp of last modification |
| `diagramTypes` | `string[]` | ✅ | Available diagram types: `["flowchart"]`, `["sequence"]`, or `["flowchart", "sequence"]` |
| `nodes` | `Node[]` | ✅ | Array of flow nodes (max 50) |
| `edges` | `Edge[]` | ✅ | Array of flow edges |
| `sourceFiles` | `SourceFile[]` | ✅ | Files analyzed during generation |
| `diagrams` | `Diagram[]` | ✅ | Mermaid source for each diagram type |

**Validation rules**:
- `id` must be a valid UUID
- `title` must be non-empty string, max 200 characters
- `nodes.length` must be ≤ 50
- `nodes.length` must equal the number of unique node IDs in `edges`
- All node references in `edges` must exist in `nodes`
- `createdAt` ≤ `updatedAt`

---

### Node

Represents a code element (file, function, class, service, etc.) in the flow.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique within the flow, used for edge references and SVG data-id |
| `label` | `string` | ✅ | Display name shown in diagram and inspector |
| `type` | `string` | ✅ | Category: `ui`, `controller`, `service`, `repository`, `model`, `api`, `sdk`, `external`, `unknown` |
| `file` | `string` | ❌ | Relative path to source file (from workspace root). Null if no file mapping |
| `lineStart` | `number` | ❌ | Starting line number in source file (1-based). Null if no file mapping |
| `lineEnd` | `number` | ❌ | Ending line number in source file (1-based). Null if no file mapping |
| `description` | `string` | ❌ | Brief description of what this code element does |

**Validation rules**:
- `id` must be non-empty, alphanumeric + underscores/hyphens
- `label` must be non-empty, max 100 characters
- `type` must be one of the allowed values
- If `file` is set, `lineStart` and `lineEnd` MUST also be set
- If `lineStart` and `lineEnd` are set, `lineStart` ≤ `lineEnd`
- `lineStart` ≥ 1

---

### Edge

Represents a directional relationship between two nodes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `string` | ✅ | ID of the source node |
| `to` | `string` | ✅ | ID of the target node |
| `label` | `string` | ❌ | Description of the relationship (e.g., "user taps pay", "calls API") |

**Validation rules**:
- `from` must reference an existing node ID
- `to` must reference an existing node ID
- `from` ≠ `to` (no self-loops)
- `label` max 200 characters

---

### SourceFile

Represents a file that was analyzed during flow generation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | ✅ | Relative path from workspace root |
| `reason` | `string` | ✅ | Why this file was included (e.g., "Contains payment button entry point") |

---

### Diagram

Represents a Mermaid diagram source for a specific diagram type.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | ✅ | `flowchart` or `sequence` |
| `mermaidSource` | `string` | ✅ | Valid Mermaid syntax string |

**Validation rules**:
- `type` must be `flowchart` or `sequence`
- `mermaidSource` must be non-empty
- `mermaidSource` must be parseable by Mermaid.js (validated at render time)

---

### HistoryEntry

Lightweight index record stored in `history.json` for fast listing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flowId` | `string` | ✅ | References `Flow.id` |
| `title` | `string` | ✅ | Copied from Flow.title |
| `description` | `string` | ✅ | Copied from Flow.description |
| `createdAt` | `string` (ISO 8601) | ✅ | Copied from Flow.createdAt |
| `updatedAt` | `string` (ISO 8601) | ✅ | Copied from Flow.updatedAt |
| `status` | `enum` | ✅ | Copied from Flow.status |
| `diagramTypes` | `string[]` | ✅ | Copied from Flow.diagramTypes |
| `nodeCount` | `number` | ✅ | `Flow.nodes.length` |
| `edgeCount` | `number` | ✅ | `Flow.edges.length` |
| `sourceFileCount` | `number` | ✅ | `Flow.sourceFiles.length` |

---

## Relationships

```
HistoryEntry 1──→ 1 Flow
Flow 1──→ 1..* Node
Flow 1──→ 0..* Edge
Flow 1──→ 1..* Diagram
Flow 1──→ 1..* SourceFile
Edge *──→ 1 Node (from)
Edge *──→ 1 Node (to)
```

## State Transitions

```
[Generation Started] → status: "success"   (all parts found)
                     → status: "partial"   (some parts missing)
                     → status: "failed"    (no relevant code found or error)
```

- `success` → `failed`: Not allowed (immutable after save)
- `failed` → `success`: User triggers regeneration (new flow, not state change)
- `partial` → `success`: User triggers regeneration (new flow, not state change)
- Any → deleted: User deletes from history

## Storage Layout

```
.vscode/flow-pilot/
├── history.json          # { "version": 1, "entries": HistoryEntry[] }
└── flows/
    ├── {uuid-1}.json     # Flow object
    ├── {uuid-2}.json     # Flow object
    └── ...
```

### history.json schema

```json
{
  "version": 1,
  "entries": [
    {
      "flowId": "a1b2c3d4-...",
      "title": "Payment System Flow",
      "description": "Flow from booking to payment completion",
      "createdAt": "2026-05-31T13:00:00+07:00",
      "updatedAt": "2026-05-31T13:00:00+07:00",
      "status": "success",
      "diagramTypes": ["flowchart", "sequence"],
      "nodeCount": 8,
      "edgeCount": 10,
      "sourceFileCount": 3
    }
  ]
}
```
