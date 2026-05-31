/**
 * Flow Pilot — History View Provider
 * WebviewViewProvider for the History sidebar panel
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getHistoryWebviewHtml } from './webviewHtml';
import { getHistoryIndex, deleteHistoryEntry, updateHistoryEntry } from '../storage/historyStorage';
import { loadFlow, deleteFlow } from '../storage/flowStorage';
import { getWorkspacePath } from '../extension';
import type { HistoryEntry } from '../types/history';

export class HistoryViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'flowpilot.history';

  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _onOpenFlow: (flowId: string) => void;

  constructor(
    extensionUri: vscode.Uri,
    onOpenFlow: (flowId: string) => void
  ) {
    this._extensionUri = extensionUri;
    this._onOpenFlow = onOpenFlow;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = getHistoryWebviewHtml(
      webviewView.webview,
      this._extensionUri
    );

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message) => {
      this._handleMessage(message);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendHistory();
      }
    });

    // Load history on view ready
    this._sendHistory();
  }

  /** Refresh the history list */
  public refresh(): void {
    this._sendHistory();
  }

  private _sendHistory(): void {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
      this._view?.webview.postMessage({
        type: 'historyLoaded',
        entries: [],
      });
      return;
    }

    const index = getHistoryIndex(workspacePath);
    this._view?.webview.postMessage({
      type: 'historyLoaded',
      entries: index.entries,
    });
  }

  private _handleMessage(message: { type: string; payload: any }): void {
    switch (message.type) {
      case 'ready':
        this._sendHistory();
        break;

      case 'openFlow':
        this._onOpenFlow(message.payload.flowId);
        break;

      case 'deleteFlow':
        this._handleDelete(message.payload.flowId);
        break;

      case 'renameFlow':
        this._handleRename(message.payload.flowId, message.payload.newTitle);
        break;

      case 'copyPrompt':
        this._handleCopyPrompt(message.payload.flowId);
        break;
    }
  }

  private async _handleDelete(flowId: string): Promise<void> {
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
      this._sendHistory();
    }
  }

  private _handleRename(flowId: string, newTitle: string): void {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) return;

    updateHistoryEntry(workspacePath, flowId, {
      title: newTitle,
      updatedAt: new Date().toISOString(),
    });
    this._sendHistory();
  }

  private async _handleCopyPrompt(flowId: string): Promise<void> {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) return;

    const flow = loadFlow(workspacePath, flowId);
    if (flow) {
      await vscode.env.clipboard.writeText(flow.requestPrompt);
      vscode.window.showInformationMessage('Prompt copied to clipboard');
    }
  }
}
