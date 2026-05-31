/**
 * Flow Pilot — Flow Viewer Provider
 * Creates and manages the Flow Viewer webview panel
 */

import * as vscode from 'vscode';
import { getFlowViewerHtml } from './webviewHtml';
import { loadFlow } from '../storage/flowStorage';
import { getWorkspacePath } from '../extension';
import type { Flow } from '../types/flow';

/** Cache of open viewer panels by flow ID */
const openPanels = new Map<string, vscode.WebviewPanel>();
const output = vscode.window.createOutputChannel('Flow Pilot');

function logViewer(message: string, data?: Record<string, unknown>): void {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  output.appendLine(`[${new Date().toISOString()}] ${message}${suffix}`);
}

function toFlowPayload(flow: Flow): Record<string, unknown> {
  return {
    flowId: flow.id,
    title: flow.title,
    status: flow.status,
    nodes: flow.nodes,
    edges: flow.edges,
    diagrams: flow.diagrams,
    sourceFiles: flow.sourceFiles,
    diagramTypes: flow.diagramTypes,
    warnings: flow.warnings,
  };
}

/** Create or reveal a flow viewer panel */
export function createFlowViewerPanel(
  extensionUri: vscode.Uri,
  flowId: string,
  flow: Flow
): void {
  output.show(true);
  logViewer('createFlowViewerPanel', {
    flowId,
    status: flow.status,
    nodeCount: flow.nodes.length,
    edgeCount: flow.edges.length,
    diagramTypes: flow.diagramTypes,
    diagramCount: flow.diagrams.length,
    firstDiagramType: flow.diagrams[0]?.type,
    firstMermaidLength: flow.diagrams[0]?.mermaidSource?.length ?? 0,
    firstMermaidPreview: flow.diagrams[0]?.mermaidSource?.slice(0, 120),
  });

  // If panel already open, reveal it
  const existing = openPanels.get(flowId);
  if (existing) {
    logViewer('revealExistingPanel', { flowId });
    existing.reveal();
    existing.webview.postMessage({
      type: 'flowLoaded',
      payload: toFlowPayload(flow),
    });
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'flowpilot.viewer',
    `Flow: ${flow.title}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri],
    }
  );

  const postFlowLoaded = () => {
    logViewer('postFlowLoaded', {
      flowId: flow.id,
      nodeCount: flow.nodes.length,
      edgeCount: flow.edges.length,
      diagramCount: flow.diagrams.length,
      diagramTypes: flow.diagramTypes,
    });
    panel.webview.postMessage({
      type: 'flowLoaded',
      payload: toFlowPayload(flow),
    });
  };

  // Send flow data to webview
  panel.webview.onDidReceiveMessage((message) => {
    if (message.type === 'viewerLog') {
      logViewer(`webview:${message.payload?.level || 'info'}`, message.payload);
      return;
    }
    handleViewerMessage(message, flow, postFlowLoaded);
  });

  panel.webview.html = getFlowViewerHtml(panel.webview, extensionUri, flow.title);
  setTimeout(postFlowLoaded, 250);

  // Clean up on close
  panel.onDidDispose(() => {
    openPanels.delete(flowId);
  });

  openPanels.set(flowId, panel);
}

/** Handle messages from the viewer webview */
function handleViewerMessage(
  message: { type: string; payload: any },
  flow: Flow,
  postFlowLoaded: () => void
): void {
  logViewer('handleViewerMessage', {
    flowId: flow.id,
    type: message.type,
    payload: message.type === 'nodeClick' ? message.payload : undefined,
  });

  switch (message.type) {
    case 'ready': {
      postFlowLoaded();
      break;
    }

    case 'nodeClick': {
      const nodeId = message.payload.nodeId;
      const node = flow.nodes.find((n) => n.id === nodeId);
      if (node) {
        // Read code snippet if file mapping exists
        let codeSnippet: string | undefined;
        if (node.file && node.lineStart) {
          try {
            const workspacePath = getWorkspacePath();
            if (workspacePath) {
              const fs = require('fs');
              const path = require('path');
              const fullPath = path.join(workspacePath, node.file);
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              const lineEnd = node.lineEnd || node.lineStart;
              codeSnippet = lines.slice(node.lineStart - 1, lineEnd).join('\n');
            }
          } catch {
            // File not found — snippet will be undefined
          }
        }

        // Find incoming/outgoing edges
        const incoming = flow.edges.filter((e) => e.to === nodeId);
        const outgoing = flow.edges.filter((e) => e.from === nodeId);

        // Send detail back to webview
        const panel = openPanels.get(flow.id);
        panel?.webview.postMessage({
          type: 'nodeDetail',
          payload: {
            nodeId: node.id,
            label: node.label,
            type: node.type,
            file: node.file,
            lineStart: node.lineStart,
            lineEnd: node.lineEnd,
            description: node.description,
            codeSnippet,
            incoming: incoming.map((e) => {
              const fromNode = flow.nodes.find((n) => n.id === e.from);
              return { from: e.from, fromLabel: fromNode?.label || e.from, label: e.label };
            }),
            outgoing: outgoing.map((e) => {
              const toNode = flow.nodes.find((n) => n.id === e.to);
              return { to: e.to, toLabel: toNode?.label || e.to, label: e.label };
            }),
          },
        });

        if (node.file && node.lineStart) {
          highlightCodeInEditor(node.file, node.lineStart, node.lineEnd || node.lineStart);
        }
      }
      break;
    }

    case 'openFile': {
      const { file, lineStart, lineEnd } = message.payload;
      openFileInEditor(file, lineStart, lineEnd);
      break;
    }

    case 'highlightCode': {
      const { file, lineStart, lineEnd } = message.payload;
      highlightCodeInEditor(file, lineStart, lineEnd);
      break;
    }

    case 'exportMermaid': {
      exportMermaid(flow);
      break;
    }

    case 'exportJson': {
      exportJson(flow);
      break;
    }
  }
}

async function openFileInEditor(filePath: string, lineStart?: number, lineEnd?: number): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;
  const path = require('path');
  const fullPath = path.join(workspacePath, filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const line = lineStart ? Math.max(0, lineStart - 1) : 0;
    await vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(line, 0, lineEnd ? lineEnd - 1 : line, 0),
      preview: true,
    });
  } catch {
    vscode.window.showErrorMessage('File not found. It may have been moved or deleted.');
  }
}

async function highlightCodeInEditor(filePath: string, lineStart?: number, lineEnd?: number): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;
  const path = require('path');
  const fullPath = path.join(workspacePath, filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const editor = await vscode.window.showTextDocument(doc);
    if (lineStart !== undefined && lineEnd !== undefined) {
      const start = new vscode.Position(lineStart - 1, 0);
      const end = new vscode.Position(lineEnd - 1, Number.MAX_SAFE_INTEGER);
      editor.selection = new vscode.Selection(start, end);
      editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    }
  } catch {
    vscode.window.showErrorMessage('File not found. It may have been moved or deleted.');
  }
}

async function exportMermaid(flow: Flow): Promise<void> {
  const content = flow.diagrams.map((d) => {
    return `## ${d.type}\n\n\`\`\`mermaid\n${d.mermaidSource}\n\`\`\`\n`;
  }).join('\n');

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${flow.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`),
    filters: { Markdown: ['md'] },
  });

  if (uri) {
    const fs = require('fs');
    fs.writeFileSync(uri.fsPath, `# ${flow.title}\n\n${content}`, 'utf-8');
    vscode.window.showInformationMessage(`Exported Mermaid to ${uri.fsPath}`);
  }
}

async function exportJson(flow: Flow): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${flow.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`),
    filters: { JSON: ['json'] },
  });

  if (uri) {
    const fs = require('fs');
    fs.writeFileSync(uri.fsPath, JSON.stringify(flow, null, 2), 'utf-8');
    vscode.window.showInformationMessage(`Exported JSON to ${uri.fsPath}`);
  }
}
