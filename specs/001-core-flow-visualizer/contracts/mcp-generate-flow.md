# MCP Tool Contract: `generate_flow`

**Date**: 2026-05-31
**Tool**: `generate_flow`
**Protocol**: MCP (Model Context Protocol)

## Tool Description

Analyzes the current workspace codebase and generates an interactive code flow diagram based on a natural language prompt.

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string",
      "description": "Natural language description of the code flow to visualize. Example: 'Show the payment flow from booking to completion'"
    }
  },
  "required": ["prompt"]
}
```

### Input Validation

| Field | Rule | Error |
|-------|------|-------|
| `prompt` | Required, non-empty string | `"prompt must be a non-empty string"` |
| `prompt` | Max 2000 characters | `"prompt exceeds maximum length of 2000 characters"` |

## Output Schema

### Success Response

```json
{
  "flowId": "a1b2c3d4-...",
  "title": "Payment System Flow",
  "status": "success",
  "summary": "Generated payment flow from booking screen to payment completion. Found 8 nodes across 3 files.",
  "historySaved": true,
  "nodeCount": 8,
  "edgeCount": 10,
  "sourceFileCount": 3,
  "diagramTypes": ["flowchart", "sequence"]
}
```

### Partial Response

```json
{
  "flowId": "b2c3d4e5-...",
  "title": "Partial: Payment Flow",
  "status": "partial",
  "summary": "Found booking and payment controller, but could not find payment confirmation handler.",
  "historySaved": true,
  "nodeCount": 5,
  "edgeCount": 6,
  "sourceFileCount": 2,
  "diagramTypes": ["flowchart"],
  "warnings": [
    "Could not find: payment confirmation handler",
    "Could not find: receipt generation service"
  ]
}
```

### Error Response

```json
{
  "flowId": null,
  "title": null,
  "status": "failed",
  "summary": "No relevant payment files found in the workspace.",
  "historySaved": false,
  "error": {
    "code": "NO_RELEVANT_FILES",
    "message": "No relevant payment files found.",
    "suggestion": "Try a more specific prompt, e.g.: 'Generate payment flow from BookingScreen to StripePaymentService'"
  }
}
```

## Error Codes

| Code | HTTP Equiv | Description | Recovery |
|------|-----------|-------------|----------|
| `NO_WORKSPACE` | 400 | No workspace folder is open | Open a project in VS Code |
| `EMPTY_PROMPT` | 400 | Prompt is empty or missing | Provide a non-empty prompt |
| `NO_RELEVANT_FILES` | 404 | No files match the prompt keywords | Refine the prompt with more specific terms |
| `NODE_LIMIT_EXCEEDED` | 413 | Analysis produced >50 nodes | Narrow the prompt to focus on a specific part |
| `MCP_ERROR` | 500 | Internal MCP processing error | Retry or check extension logs |
| `STORAGE_ERROR` | 500 | Failed to save to history | Check workspace file permissions |

## Behavior Contract

1. The tool MUST scan the current workspace for relevant files using keyword extraction from the prompt
2. The tool MUST read file contents to understand code structure
3. The tool MUST identify: entry points, function calls, class relationships, API calls, state changes
4. The tool MUST produce structured node/edge data before generating Mermaid syntax
5. The tool MUST generate at least a flowchart diagram
6. The tool SHOULD generate a sequence diagram when the flow involves component communication
7. The tool MUST enforce the 50-node hard cap — reject if exceeded
8. The tool MUST save the result to history regardless of status (success/partial/failed)
9. The tool MUST return the output schema exactly as defined above

## Webview Message Contract

### Extension → Webview: `flowLoaded`

```json
{
  "type": "flowLoaded",
  "payload": {
    "flowId": "a1b2c3d4-...",
    "title": "Payment System Flow",
    "status": "success",
    "nodes": [...],
    "edges": [...],
    "diagrams": [...],
    "sourceFiles": [...]
  }
}
```

### Extension → Webview: `generationProgress`

```json
{
  "type": "generationProgress",
  "payload": {
    "step": "Searching relevant files",
    "progress": 40
  }
}
```

### Webview → Extension: `nodeClick`

```json
{
  "type": "nodeClick",
  "payload": {
    "nodeId": "booking_screen"
  }
}
```

### Extension → Webview: `nodeDetail`

```json
{
  "type": "nodeDetail",
  "payload": {
    "nodeId": "booking_screen",
    "label": "Booking Screen",
    "type": "ui",
    "file": "lib/features/booking/booking_screen.dart",
    "lineStart": 24,
    "lineEnd": 90,
    "description": "User starts payment from booking screen",
    "codeSnippet": "class BookingScreen extends StatelessWidget {\n  ...\n}",
    "incomingEdges": [...],
    "outgoingEdges": [...]
  }
}
```

### Webview → Extension: `openFile`

```json
{
  "type": "openFile",
  "payload": {
    "file": "lib/features/booking/booking_screen.dart",
    "lineStart": 24,
    "lineEnd": 90
  }
}
```

### Webview → Extension: `highlightCode`

```json
{
  "type": "highlightCode",
  "payload": {
    "file": "lib/features/booking/booking_screen.dart",
    "lineStart": 24,
    "lineEnd": 90
  }
}
```

### Webview → Extension: `deleteFlow`

```json
{
  "type": "deleteFlow",
  "payload": {
    "flowId": "a1b2c3d4-..."
  }
}
```

### Webview → Extension: `renameFlow`

```json
{
  "type": "renameFlow",
  "payload": {
    "flowId": "a1b2c3d4-...",
    "newTitle": "Updated Payment Flow Title"
  }
}
```
