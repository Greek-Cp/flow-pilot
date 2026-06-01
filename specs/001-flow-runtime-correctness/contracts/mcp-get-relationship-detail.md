# MCP Contract: get_relationship_detail

## Tool

`get_relationship_detail`

## Purpose

Return evidence and context for a relationship between two nodes in a saved flow.

## Input Schema

```json
{
  "flowId": "uuid/string",
  "from": "source node id",
  "to": "target node id"
}
```

## Success Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.relationshipDetail",
  "flowId": "uuid/string",
  "relationship": {
    "from": "source node id",
    "to": "target node id",
    "label": "optional string",
    "reason": "optional string",
    "confidence": 0.6,
    "evidence": []
  },
  "fromNode": {
    "id": "string",
    "label": "string",
    "type": "service",
    "file": "optional path"
  },
  "toNode": {
    "id": "string",
    "label": "string",
    "type": "repository",
    "file": "optional path"
  },
  "evidence": []
}
```

## Error Response

```json
{
  "schemaVersion": 1,
  "type": "flow-pilot.error",
  "flowId": "uuid/string",
  "from": "source node id",
  "to": "target node id",
  "error": {
    "code": "NO_WORKSPACE | FLOW_NOT_FOUND | RELATIONSHIP_NOT_FOUND | MCP_ERROR",
    "message": "string"
  }
}
```
