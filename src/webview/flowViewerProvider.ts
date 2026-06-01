/**
 * Flow Pilot — Flow Viewer Provider
 * Creates and manages the Flow Viewer webview panel
 */

import * as vscode from 'vscode';
import { getFlowViewerHtml } from './webviewHtml';
import { getWorkspacePath } from '../extension';
import { openFileInEditor, highlightCodeInEditor } from '../commands/highlightCodeCommand';
import { readCodeSnippet } from '../mcp/detailTools';
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
    payload: message.type === 'nodeClick' || message.type === 'processClick' ? message.payload : undefined,
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
        const workspacePath = getWorkspacePath();
        if (workspacePath) {
          codeSnippet = readCodeSnippet(workspacePath, node);
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
            symbolName: node.symbolName,
            reason: node.reason,
            confidence: node.confidence,
            evidence: node.evidence,
            codeSnippet,
            incoming: incoming.map((e) => {
              const fromNode = flow.nodes.find((n) => n.id === e.from);
              return {
                from: e.from,
                fromLabel: fromNode?.label || e.from,
                label: e.label,
                reason: e.reason,
                confidence: e.confidence,
                evidence: e.evidence,
              };
            }),
            outgoing: outgoing.map((e) => {
              const toNode = flow.nodes.find((n) => n.id === e.to);
              return {
                to: e.to,
                toLabel: toNode?.label || e.to,
                label: e.label,
                reason: e.reason,
                confidence: e.confidence,
                evidence: e.evidence,
              };
            }),
          },
        });

        if (node.file && node.lineStart) {
          void highlightCodeInEditor(node.file, node.lineStart, node.lineEnd || node.lineStart);
        }
      }
      break;
    }

    case 'processClick': {
      const { from, to, label } = message.payload;
      const edge = flow.edges.find((e) => e.from === from && e.to === to && (!label || e.label === label)) ||
        flow.edges.find((e) => e.from === from && e.to === to);
      if (!edge) break;

      const evidence = edge.evidence?.find((item) => item.file);
      if (evidence?.file) {
        void highlightCodeInEditor(evidence.file, evidence.lineStart || 1, evidence.lineEnd || evidence.lineStart || 1);
        break;
      }

      const toNode = flow.nodes.find((n) => n.id === edge.to && n.file && n.lineStart);
      const fromNode = flow.nodes.find((n) => n.id === edge.from && n.file && n.lineStart);
      const targetNode = toNode || fromNode;
      if (targetNode?.file && targetNode.lineStart) {
        void highlightCodeInEditor(targetNode.file, targetNode.lineStart, targetNode.lineEnd || targetNode.lineStart);
      }
      break;
    }

    case 'openFile': {
      const { file, lineStart, lineEnd } = message.payload;
      void openFileInEditor(file, lineStart, lineEnd);
      break;
    }

    case 'highlightCode': {
      const { file, lineStart, lineEnd } = message.payload;
      void highlightCodeInEditor(file, lineStart, lineEnd);
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
