/**
 * Flow Pilot — Extension Entry Point
 * VS Code Extension activation and deactivation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { HistoryViewProvider } from './webview/historyViewProvider';
import { createFlowViewerPanel } from './webview/flowViewerProvider';
import { loadFlow } from './storage/flowStorage';
import { openFileInEditor, highlightCodeInEditor } from './commands/highlightCodeCommand';

/** Get the current workspace folder path, or undefined if no workspace */
export function getWorkspacePath(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri.fsPath;
}

/** Get the storage base path for Flow Pilot */
export function getStoragePath(workspacePath: string): string {
  return path.join(workspacePath, '.vscode', 'flow-pilot');
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('[Flow Pilot] Extension activated');

  // History View Provider
  const historyProvider = new HistoryViewProvider(
    context.extensionUri,
    (flowId: string) => {
      console.log(`[Flow Pilot] Open flow: ${flowId}`);
      const workspacePath = getWorkspacePath();
      if (workspacePath) {
        const flow = loadFlow(workspacePath, flowId);
        if (flow) {
          createFlowViewerPanel(context.extensionUri, flowId, flow);
        } else {
          vscode.window.showErrorMessage('Flow not found.');
        }
      }
    }
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HistoryViewProvider.viewType,
      historyProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Commands
  const openHistoryCmd = vscode.commands.registerCommand(
    'flowpilot.openHistory',
    () => {
      vscode.commands.executeCommand('flowpilot.history.focus');
    }
  );

  const openFlowCmd = vscode.commands.registerCommand(
    'flowpilot.openFlow',
    (flowId?: string) => {
      if (flowId) {
        console.log(`[Flow Pilot] Open flow: ${flowId}`);
      }
    }
  );

  const highlightCodeCmd = vscode.commands.registerCommand(
    'flowpilot.highlightCode',
    async (filePath?: string, lineStart?: number, lineEnd?: number) => {
      if (filePath && lineStart !== undefined) {
        await highlightCodeInEditor(filePath, lineStart, lineEnd);
      }
    }
  );

  context.subscriptions.push(openHistoryCmd, openFlowCmd, highlightCodeCmd);

  // ── MCP Server Definition Provider ──
  const mcpProvider: vscode.McpServerDefinitionProvider = {
    onDidChangeMcpServerDefinitions: undefined,
    provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
      const workspacePath = getWorkspacePath();
      // Path to the standalone MCP server entry point
      const serverScript = path.join(context.extensionPath, 'out', 'mcp', 'standalone.js');

      return [
        new vscode.McpStdioServerDefinition(
          'Flow Pilot',
          process.execPath, // Use VS Code's Node.js
          [serverScript, workspacePath || ''],
          {}
        ),
      ];
    },
    resolveMcpServerDefinition(server: vscode.McpServerDefinition): vscode.McpServerDefinition {
      // No resolution needed — server is ready as-is
      return server;
    },
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('flow-pilot', mcpProvider)
  );
  console.log('[Flow Pilot] MCP server definition provider registered');
}

export function deactivate(): void {
  console.log('[Flow Pilot] Extension deactivated');
}
