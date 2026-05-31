/**
 * Flow Pilot — Flow Storage
 * CRUD operations for individual flow JSON files
 */

import * as path from 'path';
import type { Flow } from '../types/flow';
import { validateFlow } from './validation';

const FLOWS_DIR = '.vscode/flow-pilot/flows';

function getFlowPath(workspacePath: string, flowId: string): string {
  return path.join(workspacePath, FLOWS_DIR, `${flowId}.json`);
}

/** Save a flow to disk. Validates before writing. */
export function saveFlow(workspacePath: string, flow: Flow): void {
  const validation = validateFlow(flow);
  if (!validation.valid) {
    const messages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Flow validation failed: ${messages}`);
  }

  const filePath = getFlowPath(workspacePath, flow.id);
  const dirPath = path.join(workspacePath, FLOWS_DIR);
  const fs = require('fs');

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(flow, null, 2), 'utf-8');
}

/** Load a flow from disk by ID */
export function loadFlow(workspacePath: string, flowId: string): Flow | null {
  const filePath = getFlowPath(workspacePath, flowId);
  const fs = require('fs');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Flow;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/** Delete a flow file from disk */
export function deleteFlow(workspacePath: string, flowId: string): void {
  const filePath = getFlowPath(workspacePath, flowId);
  const fs = require('fs');

  try {
    fs.unlinkSync(filePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/** Check if a flow file exists */
export function flowExists(workspacePath: string, flowId: string): boolean {
  const filePath = getFlowPath(workspacePath, flowId);
  const fs = require('fs');
  return fs.existsSync(filePath);
}
