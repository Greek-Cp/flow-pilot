/**
 * Flow Pilot — Flow Builder
 * Converts raw AI output into validated Flow objects
 */

import * as crypto from 'crypto';
import type { Flow, Node, Edge, Diagram, SourceFile, DiagramType, Evidence, NodeType } from '../types/flow';
import type { HistoryEntry } from '../types/history';
import { validateFlow } from '../storage/validation';

const MAX_NODES = 50;

export interface RawNode {
  id: string;
  label: string;
  type?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  description?: string;
  symbolName?: string;
  reason?: string;
  confidence?: number;
  evidence?: Evidence[];
}

export interface RawEdge {
  from: string;
  to: string;
  label?: string;
  reason?: string;
  confidence?: number;
  evidence?: Evidence[];
}

export type FlowBuildResult = {
  success: true;
  flow: Flow;
  historyEntry: HistoryEntry;
} | {
  success: false;
  errorCode: string;
  errorMessage: string;
};

/** Build a complete Flow object from raw AI output */
export function buildFlow(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  prompt: string,
  sourceFiles: SourceFile[],
  diagramSources: { type: DiagramType; mermaidSource: string }[],
  status: 'success' | 'partial' | 'failed' = 'success',
  warnings?: string[]
): FlowBuildResult {
  // Validate node count
  if (rawNodes.length > MAX_NODES) {
    return {
      success: false,
      errorCode: 'NODE_LIMIT_EXCEEDED',
      errorMessage: `Flow too large (${rawNodes.length} nodes found, max ${MAX_NODES}). Please narrow your prompt to focus on a specific part of the codebase.`,
    };
  }

  // Build nodes with defaults
  const nodes: Node[] = rawNodes.map((raw) => ({
    id: raw.id,
    label: raw.label,
    type: normalizeNodeType(raw.type),
    file: raw.file || null,
    lineStart: raw.lineStart || null,
    lineEnd: raw.lineEnd || null,
    description: raw.description,
    symbolName: raw.symbolName,
    reason: raw.reason,
    confidence: raw.confidence,
    evidence: raw.evidence,
  }));

  // Build edges
  const edges: Edge[] = rawEdges.map((raw) => ({
    from: raw.from,
    to: raw.to,
    label: raw.label,
    reason: raw.reason,
    confidence: raw.confidence,
    evidence: raw.evidence,
  }));

  // Build diagrams
  const diagrams: Diagram[] = diagramSources.map((d) => ({
    type: d.type,
    mermaidSource: d.mermaidSource,
  }));

  const diagramTypes: DiagramType[] = diagrams.map((d) => d.type);

  const now = new Date().toISOString();
  const flowId = crypto.randomUUID();

  const flow: Flow = {
    id: flowId,
    title: generateTitle(prompt),
    description: `Code flow generated from prompt: "${prompt.substring(0, 100)}"`,
    requestPrompt: prompt,
    status,
    createdAt: now,
    updatedAt: now,
    diagramTypes,
    nodes,
    edges,
    sourceFiles,
    diagrams,
    warnings,
  };

  // Validate the complete flow
  const validation = validateFlow(flow);
  if (!validation.valid) {
    const messages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    return {
      success: false,
      errorCode: 'VALIDATION_FAILED',
      errorMessage: `Flow validation failed: ${messages}`,
    };
  }

  // Build history entry
  const historyEntry: HistoryEntry = {
    flowId: flow.id,
    title: flow.title,
    description: flow.description,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
    status: flow.status,
    diagramTypes: flow.diagramTypes,
    nodeCount: flow.nodes.length,
    edgeCount: flow.edges.length,
    sourceFileCount: flow.sourceFiles.length,
  };

  return { success: true, flow, historyEntry };
}

const VALID_NODE_TYPES: readonly NodeType[] = [
  'file', 'function', 'class', 'method', 'module', 'process',
  'decision', 'success', 'error',
  'ui', 'controller', 'service', 'repository',
  'datasource', 'model', 'api', 'sdk', 'external', 'unknown',
];

function normalizeNodeType(type: string | undefined): NodeType {
  if (!type) return 'unknown';
  return VALID_NODE_TYPES.includes(type as NodeType) ? type as NodeType : 'unknown';
}

/** Generate a human-readable title from the prompt */
function generateTitle(prompt: string): string {
  // Clean and truncate
  let title = prompt
    .replace(/^(show|find|generate|create|display|trace|visualize|pelajari|tunjukkan|cari)\s+/i, '')
    .replace(/\s+(flow|diagram|chart)$/i, '')
    .trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Truncate to 100 chars
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }

  return title || 'Generated Flow';
}
