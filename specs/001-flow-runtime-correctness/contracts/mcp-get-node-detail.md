# MCP Contract: get_node_detail

## Tool

`get_node_detail`

## Purpose

Return source-backed metadata, relationships, evidence, and code snippet for a node in a saved flow.

## Input Schema

```json
{
  "flowId": "uuid/string",
  "nodeId": "string",
  "includeCodeSnippet": true
}
```

`includeCodeSnippet` defaults to `true`.

## Success Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.nodeDetail",
  "flowId": "uuid/string",
  "node": {
    "id": "string",
    "label": "string",
    "type": "file",
    "file": "relative/path.ts",
    "lineStart": 1,
    "lineEnd": 50,
    "symbolName": "optional string",
    "description": "optional string",
    "reason": "optional string",
    "confidence": 0.85,
    "evidence": []
  },
  "incoming": [
    {
      "edge": {},
      "node": {
        "id": "string",
        "label": "string",
        "type": "service",
        "file": "optional path"
      }
    }
  ],
  "outgoing": [
    {
      "edge": {},
      "node": {
        "id": "string",
        "label": "string",
        "type": "api",
        "file": "optional path"
      }
    }
  ],
  "evidence": [],
  "codeSnippet": "optional source snippet"
}
```

## Error Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.error",
  "flowId": "uuid/string",
  "nodeId": "string",
  "error": {
    "code": "NO_WORKSPACE | FLOW_NOT_FOUND | NODE_NOT_FOUND | SOURCE_NOT_FOUND | MCP_ERROR",
    "message": "string"
  }
}
```
