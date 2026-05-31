/**
 * Flow Pilot — Message Handler
 * Routes webview ↔ extension messages
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspacePath } from '../extension';
import { loadFlow } from '../storage/flowStorage';
import { updateHistoryEntry, deleteHistoryEntry } from '../storage/historyStorage';
import { deleteFlow } from '../storage/flowStorage';

export interface WebviewMessage {
  type: string;
  payload: any;
}

/** Handle incoming webview messages. Returns true if handled. */
export function handleWebviewMessage(
  message: WebviewMessage,
  callbacks: {
    onOpenFlow?: (flowId: string) => void;
    onRefreshHistory?: () => void;
  }
): boolean {
  switch (message.type) {
    case 'openFlow':
      callbacks.onOpenFlow?.(message.payload.flowId);
      return true;

    case 'nodeClick':
      // Will be wired in US4
      return true;

    case 'openFile':
      openFileInEditor(message.payload.file, message.payload.lineStart, message.payload.lineEnd);
      return true;

    case 'highlightCode':
      highlightCodeInEditor(message.payload.file, message.payload.lineStart, message.payload.lineEnd);
      return true;

    case 'deleteFlow':
      handleDeleteFlow(message.payload.flowId, callbacks.onRefreshHistory);
      return true;

    case 'renameFlow':
      handleRenameFlow(message.payload.flowId, message.payload.newTitle, callbacks.onRefreshHistory);
      return true;

    case 'copyPrompt':
      handleCopyPrompt(message.payload.flowId);
      return true;

    default:
      return false;
  }
}

async function openFileInEditor(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  const fullPath = path.join(workspacePath, filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const line = lineStart ? Math.max(0, lineStart - 1) : 0;
    const selection = new vscode.Range(line, 0, lineEnd ? lineEnd - 1 : line, 0);
    await vscode.window.showTextDocument(doc, { selection, preview: true });
  } catch {
    vscode.window.showErrorMessage(
      'File not found. It may have been moved or deleted.'
    );
  }
}

async function highlightCodeInEditor(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

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
    vscode.window.showErrorMessage(
      'File not found. It may have been moved or deleted.'
    );
  }
}

async function handleDeleteFlow(
  flowId: string,
  onRefresh?: () => void
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  const result = await vscode.window.showWarningMessage(
    'Delete this flow from history?',
    { modal: true },
    'Delete'
  );

  if (result === 'Delete') {
    deleteHistoryEntry(workspacePath, flowId);
    deleteFlow(workspacePath, flowId);
    onRefresh?.();
  }
}

function handleRenameFlow(
  flowId: string,
  newTitle: string,
  onRefresh?: () => void
): void {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  updateHistoryEntry(workspacePath, flowId, {
    title: newTitle,
    updatedAt: new Date().toISOString(),
  });
  onRefresh?.();
}

async function handleCopyPrompt(flowId: string): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) return;

  const flow = loadFlow(workspacePath, flowId);
  if (flow) {
    await vscode.env.clipboard.writeText(flow.requestPrompt);
    vscode.window.showInformationMessage('Prompt copied to clipboard');
  }
}
