/**
 * Flow Pilot — Extension Entry Point
 * VS Code Extension activation and deactivation
 */

import * as vscode from 'vscode';
import * as path from 'path';

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

  // Commands will be registered by their respective modules
  // For now, register stubs

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
        // Will be wired to flowViewerProvider in US3
      }
    }
  );

  const highlightCodeCmd = vscode.commands.registerCommand(
    'flowpilot.highlightCode',
    (filePath?: string, lineStart?: number, lineEnd?: number) => {
      if (filePath && lineStart !== undefined) {
        console.log(`[Flow Pilot] Highlight: ${filePath}:${lineStart}-${lineEnd}`);
        // Will be wired to highlightCodeCommand in US5
      }
    }
  );

  context.subscriptions.push(openHistoryCmd, openFlowCmd, highlightCodeCmd);
}

export function deactivate(): void {
  console.log('[Flow Pilot] Extension deactivated');
}
