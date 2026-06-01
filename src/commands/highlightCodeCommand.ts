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
  if (!isInsideWorkspace(workspacePath, fullPath)) {
    vscode.window.showErrorMessage('File path is outside the current workspace.');
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    const selection = createDocumentRange(doc, lineStart, lineEnd);
    // Open beside the Flow Viewer so the webview is not replaced/closed.
    await vscode.window.showTextDocument(doc, {
      selection,
      preview: true,
      viewColumn: vscode.ViewColumn.Beside,
    });
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
  if (!isInsideWorkspace(workspacePath, fullPath)) {
    vscode.window.showErrorMessage('File path is outside the current workspace.');
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(fullPath);
    // Open beside the Flow Viewer (keep focus on the diagram) so it stays open.
    const editor = await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true,
      preview: true,
    });
    const range = createDocumentRange(doc, lineStart, lineEnd);
    const start = range.start;
    const end = range.end;
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch {
    vscode.window.showErrorMessage(
      'File not found. It may have been moved or deleted.'
    );
  }
}

function createDocumentRange(
  doc: vscode.TextDocument,
  lineStart?: number,
  lineEnd?: number
): vscode.Range {
  const maxLine = Math.max(0, doc.lineCount - 1);
  const startLine = clampLine(lineStart ?? 1, maxLine);
  const endLine = clampLine(lineEnd ?? lineStart ?? 1, maxLine);
  const normalizedEndLine = Math.max(startLine, endLine);
  const endCharacter = doc.lineAt(normalizedEndLine).text.length;
  return new vscode.Range(startLine, 0, normalizedEndLine, endCharacter);
}

function clampLine(line: number, maxLine: number): number {
  if (!Number.isFinite(line)) return 0;
  return Math.max(0, Math.min(maxLine, Math.floor(line) - 1));
}

function isInsideWorkspace(workspacePath: string, fullPath: string): boolean {
  const relative = path.relative(path.resolve(workspacePath), fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
