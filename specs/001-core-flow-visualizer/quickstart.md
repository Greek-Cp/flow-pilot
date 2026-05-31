# Quickstart: Flow Pilot

**Date**: 2026-05-31

## Prerequisites

- Node.js 18+ and npm
- VS Code 1.80+
- A workspace with source code to analyze

## Setup

```bash
# Clone and install
git clone <repo-url>
cd flow-pilot
npm install

# Compile TypeScript
npm run compile
```

## Run in Development

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, open a workspace with source code
4. The Flow Pilot icon appears in the Activity Bar sidebar

## Generate Your First Flow

1. Open the Flow Pilot panel from the sidebar (or run `Flow Pilot: Open History` from Command Palette)
2. You'll see the empty state: "No flow generated yet"
3. Open Copilot Chat or your MCP-enabled AI assistant
4. Run: `generate_flow` with prompt: `"Show the main entry point flow of this project"`
5. Watch the progress indicator as the AI scans your codebase
6. The diagram appears in the Flow Viewer when complete
7. Click any node to see its details in the inspector panel

## Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires VS Code)
npm run test:integration

# All tests
npm test
```

## Package Extension

```bash
npm run package
# Produces flow-pilot-{version}.vsix
```

## Key Commands

| Command | Description |
|---------|-------------|
| `Flow Pilot: Open History` | Open the history panel |
| `Flow Pilot: Open Flow` | Open a specific flow by ID |
| `Flow Pilot: Highlight Code` | Highlight code range in editor |

## File Locations

| File | Purpose |
|------|---------|
| `.vscode/flow-pilot/history.json` | Flow history index |
| `.vscode/flow-pilot/flows/{id}.json` | Individual flow data |
