/**
 * Flow Pilot — Webview HTML Generator
 * Generates CSP-compliant HTML for webviews
 */

import * as vscode from 'vscode';
import * as path from 'path';

/** Generate HTML for the History webview */
export function getHistoryWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'history', 'history.css')
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'history', 'history.js')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Flow Pilot — History</title>
</head>
<body>
  <div id="app">
    <div id="empty-state" class="empty-state hidden">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12h5" />
          <path d="M9 12c2.5 0 2.5-5 5-5h6" />
          <path d="M9 12c2.5 0 2.5 5 5 5h6" />
          <rect x="2.75" y="9.75" width="4.5" height="4.5" rx="1" />
          <rect x="13.25" y="4.75" width="4.5" height="4.5" rx="1" />
          <rect x="13.25" y="14.75" width="4.5" height="4.5" rx="1" />
        </svg>
      </div>
      <h2>No flow generated yet</h2>
      <p>Ask AI to generate your first code flow using MCP.</p>
      <p class="hint">Example: "Generate payment flow from booking to payment completed."</p>
    </div>
    <div id="history-list" class="history-list hidden"></div>
    <div id="loading" class="loading">
      <p>Loading history...</p>
    </div>
  </div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

/** Generate HTML for the Flow Viewer webview */
export function getFlowViewerHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  flowTitle: string
): string {
  const viewerStyleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'viewer', 'viewer.css')
  );
  const viewerScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'viewer', 'viewer.js')
  );
  const flowchartReactScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'viewer', 'flowchart-react.js')
  );
  const flowchartReactStyleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'viewer', 'flowchart-react.css')
  );
  const mermaidScriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'shared', 'mermaid.min.js')
  );
  const mermaidInitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'shared', 'mermaid-init.js')
  );
  const themeStyleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'webview', 'shared', 'theme.css')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${themeStyleUri}">
  <link rel="stylesheet" href="${flowchartReactStyleUri}">
  <link rel="stylesheet" href="${viewerStyleUri}">
  <title>Flow Pilot — ${flowTitle}</title>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1 class="flow-title">${flowTitle}</h1>
    </div>
    <div class="toolbar">
      <button id="zoom-out" class="toolbar-btn" title="Zoom Out">−</button>
      <span id="zoom-level" class="zoom-label">100%</span>
      <button id="zoom-in" class="toolbar-btn" title="Zoom In">+</button>
      <span class="toolbar-sep"></span>
      <button id="zoom-fit" class="toolbar-btn" title="Fit to Screen">Fit</button>
      <button id="zoom-reset" class="toolbar-btn" title="Reset Zoom">Reset</button>
      <span class="toolbar-sep"></span>
      <button id="domain-toggle" class="toolbar-btn" title="Toggle Domain Areas" aria-pressed="false">Domain Areas</button>
    </div>
    <div class="diagram-tabs">
      <button class="tab-btn active" data-type="flowchart">Flowchart</button>
      <button class="tab-btn" data-type="sequence">Sequence</button>
    </div>
    <div id="legend" class="legend" aria-label="Diagram legend"></div>
    <div class="content">
      <div class="diagram-container" id="diagram-container">
        <div id="diagram" class="diagram"></div>
      </div>
      <aside class="inspector" id="inspector">
        <div id="inspector-resize-handle" class="inspector-resize-handle"></div>
        <div class="inspector-header">
          <h2 class="inspector-title">Node Inspector</h2>
        </div>
        <div id="inspector-content" class="inspector-content">
          <div class="inspector-placeholder"><p>Click a node to inspect</p></div>
        </div>
      </aside>
    </div>
    <div id="progress" class="progress hidden">
      <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
      <p id="progress-text">Generating...</p>
    </div>
    <div id="error-banner" class="error-banner hidden">
      <p id="error-text"></p>
    </div>
  </div>
  <script src="${mermaidScriptUri}"></script>
  <script src="${mermaidInitUri}"></script>
  <script src="${flowchartReactScriptUri}"></script>
  <script src="${viewerScriptUri}"></script>
</body>
</html>`;
}
