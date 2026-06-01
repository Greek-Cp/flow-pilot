# MCP Contract: generate_flow

## Tool

`generate_flow`

## Purpose

Analyze the current workspace and persist an interactive Flow Pilot diagram from a natural-language prompt.

## Input Schema

```json
{
  "prompt": "string, 1-2000 characters"
}
```

## Success Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.flow",
  "flowId": "uuid",
  "title": "string",
  "status": "success | partial",
  "summary": "string",
  "historySaved": true,
  "nodeCount": 1,
  "edgeCount": 0,
  "sourceFileCount": 1,
  "diagramTypes": ["flowchart", "sequence"],
  "legend": [
    { "type": "ui", "icon": "parallelogram", "meaning": "Screen / page (halaman) in the app" }
  ],
  "readingGuide": "string — how to read the diagram, including the list of screens/pages",
  "warnings": ["string"],
  "flow": {
    "id": "uuid",
    "nodes": [
      {
        "id": "string",
        "label": "string",
        "type": "file | function | class | method | module | process | ui | controller | service | repository | datasource | model | api | sdk | external | unknown",
        "file": "relative/path.ts",
        "lineStart": 1,
        "lineEnd": 50,
        "symbolName": "optional string",
        "description": "optional string",
        "reason": "optional string",
        "confidence": 0.85,
        "evidence": [
          {
            "kind": "file | symbol | snippet | filename | prompt | relationship",
            "file": "relative/path.ts",
            "lineStart": 1,
            "lineEnd": 12,
            "symbolName": "optional string",
            "snippet": "optional short snippet",
            "reason": "string"
          }
        ]
      }
    ],
    "edges": [
      {
        "from": "sourceNodeId",
        "to": "targetNodeId",
        "label": "optional string",
        "reason": "optional string",
        "confidence": 0.6,
        "evidence": []
      }
    ]
  },
  "historyEntry": {}
}
```

## Error Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.error",
  "flowId": null,
  "title": null,
  "status": "failed",
  "summary": "string",
  "historySaved": false,
  "error": {
    "code": "EMPTY_PROMPT | NO_WORKSPACE | MCP_ERROR | NODE_LIMIT_EXCEEDED | VALIDATION_FAILED | STORAGE_ERROR",
    "message": "string",
    "suggestion": "optional string"
  }
}
```

## Compatibility

This contract keeps `schemaVersion: 1` and adds optional node/edge metadata fields plus a top-level `legend` and `readingGuide`. Existing clients that read only the previous required fields remain compatible.

## Diagram Legibility

The generated flowchart renders each node with a type-specific Mermaid shape, while the UI legend shows a miniature version of that shape so screens, operations, APIs, services, and data stores are visually distinct:

- `external` uses `user` with a stadium shape (user/actor)
- `ui` uses a parallelogram shape (screen/page)
- `process`, `function`, and `method` use a rectangle shape (operation step)
- `api` / `controller` use a hexagon shape (endpoint)
- `service` / `sdk` / `repository` use a subroutine shape (logic/component)
- `datasource` uses a cylinder shape (data source/storage)
- `model` uses a rounded shape (data model)
- everything else uses a rectangle shape (code/file)

The sequence diagram keeps participant labels plain for readability. `legend` lists only the types present, and `readingGuide` explains the shapes and lists the screens/pages.
