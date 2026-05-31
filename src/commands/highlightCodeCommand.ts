/**
 * Flow Pilot — Highlight Code Command
 * Opens source files and highlights line ranges
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspacePath } from '../extension';

/** Open a file in the VS Code editor at a specific line range */
export async function openFileInEditor(
  filePath: string,
  lineStart?: number,
  lineEnd?: number
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showWarningMessage('No workspace folder opened.');
    return;
  }

  const fullPath = path.resolve(workspacePath, filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const line = lineStart ? Math.max(0, lineStart - 1) : 0;
    const endLine = lineEnd ? lineEnd - 1 : line;
    const selection = new vscode.Range(line, 0, endLine, 0);
    await vscode.window.showTextDocument(doc, { selection, preview: true });
  } catch {
    vscode.window.showErrorMessage(
      'File not found. It may have been moved or deleted.'
    );
  }
}

/** Open a file and highlight a specific line range */
export async function highlightCodeInEditor(
  filePath: string,
  lineStart: number,
  lineEnd?: number
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showWarningMessage('No workspace folder opened.');
    return;
  }

  const fullPath = path.resolve(workspacePath, filePath);
  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const editor = await vscode.window.showTextDocument(doc);
    const start = new vscode.Position(lineStart - 1, 0);
    const end = lineEnd
      ? new vscode.Position(lineEnd - 1, Number.MAX_SAFE_INTEGER)
      : start;
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(
      new vscode.Range(start, end),
      vscode.TextEditorRevealType.InCenter
    );
  } catch {
    vscode.window.showErrorMessage(
      'File not found. It may have been moved or deleted.'
    );
  }
}
