/**
 * Flow Pilot — History Storage
 * CRUD operations for .vscode/flow-pilot/history.json
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { HistoryEntry, HistoryIndex } from '../types/history';

const HISTORY_DIR = '.vscode/flow-pilot';
const HISTORY_FILE = 'history.json';
const CURRENT_VERSION = 1;

function getHistoryPath(workspacePath: string): string {
  return path.join(workspacePath, HISTORY_DIR, HISTORY_FILE);
}

/** Read the history index from disk. Returns empty index if file missing or corrupt. */
export function getHistoryIndex(workspacePath: string): HistoryIndex {
  const filePath = getHistoryPath(workspacePath);
  try {
    const uri = vscode.Uri.file(filePath);
    // Synchronous read via fs (available in extension host)
    const content = require('fs').readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as HistoryIndex;
    if (!data.version || !Array.isArray(data.entries)) {
      throw new Error('Invalid history format');
    }
    return data;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // File doesn't exist yet — return empty
      return { version: CURRENT_VERSION, entries: [] };
    }
    // Corrupt file — backup and recreate
    backupCorruptFile(workspacePath, filePath);
    return { version: CURRENT_VERSION, entries: [] };
  }
}

/** Add a new entry to the history index */
export function addHistoryEntry(workspacePath: string, entry: HistoryEntry): void {
  const index = getHistoryIndex(workspacePath);
  index.entries.unshift(entry); // newest first
  saveHistoryIndex(workspacePath, index);
}

/** Update an existing history entry by flowId */
export function updateHistoryEntry(
  workspacePath: string,
  flowId: string,
  updates: Partial<HistoryEntry>
): void {
  const index = getHistoryIndex(workspacePath);
  const idx = index.entries.findIndex((e) => e.flowId === flowId);
  if (idx === -1) {
    throw new Error(`History entry not found: ${flowId}`);
  }
  index.entries[idx] = { ...index.entries[idx], ...updates };
  saveHistoryIndex(workspacePath, index);
}

/** Delete a history entry by flowId */
export function deleteHistoryEntry(workspacePath: string, flowId: string): void {
  const index = getHistoryIndex(workspacePath);
  index.entries = index.entries.filter((e) => e.flowId !== flowId);
  saveHistoryIndex(workspacePath, index);
}

/** Save the history index to disk */
function saveHistoryIndex(workspacePath: string, index: HistoryIndex): void {
  const filePath = getHistoryPath(workspacePath);
  const dirPath = path.join(workspacePath, HISTORY_DIR);
  const fs = require('fs');

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

/** Backup a corrupt history file and start fresh */
function backupCorruptFile(workspacePath: string, filePath: string): void {
  const fs = require('fs');
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.corrupt.${timestamp}`;
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      console.warn(`[Flow Pilot] History file corrupt. Backed up to: ${backupPath}`);
    }
  } catch {
    console.error('[Flow Pilot] Failed to backup corrupt history file');
  }
}
