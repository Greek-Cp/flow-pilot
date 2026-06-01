/**
 * Flow Pilot — AI-authored flow tool
 *
 * Lets the MCP client/AI submit the graph it decided after reading source code.
 * Flow Pilot handles validation, Mermaid generation, persistence, and inspector
 * evidence, while the AI owns the semantic mapping.
 */

import { buildFlow, type RawEdge, type RawNode } from './flowBuilder';
import { buildMermaidFlowchart, buildMermaidSequence } from './mermaidBuilder';
import { saveFlow } from '../storage/flowStorage';
import { addHistoryEntry } from '../storage/historyStorage';
import type { DiagramType, Evidence, SourceFile } from '../types/flow';

export interface AiNodeInput {
  id: string;
  label: string;
  type?: string;
  file?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  description?: string;
  symbolName?: string;
  reason?: string;
  confidence?: number;
  evidence?: Evidence[];
}

export interface AiEdgeInput {
  from: string;
  to: string;
  label?: string;
  reason?: string;
  confidence?: number;
  evidence?: Evidence[];
}

export interface CreateAiFlowArgs {
  prompt: string;
  title?: string;
  nodes: AiNodeInput[];
  edges: AiEdgeInput[];
  flowchartMermaidSource?: string;
  sequenceMermaidSource?: string;
  warnings?: string[];
}

export type CreateAiFlowResponse = {
  schemaVersion: 1;
  type: 'flow-pilot.flow';
  flowId: string;
  title: string;
  status: 'success';
  summary: string;
  historySaved: true;
  nodeCount: number;
  edgeCount: number;
  sourceFileCount: number;
  diagramTypes: string[];
  flowPath?: string;
} | {
  schemaVersion: 1;
  type: 'flow-pilot.error';
  flowId: null;
  title: string | null;
  status: 'failed';
  summary: string;
  historySaved: false;
  error: {
    code: 'NO_WORKSPACE' | 'EMPTY_FLOW' | 'VALIDATION_FAILED' | 'STORAGE_ERROR';
    message: string;
    suggestion?: string;
  };
};

type CreateAiFlowErrorCode = 'NO_WORKSPACE' | 'EMPTY_FLOW' | 'VALIDATION_FAILED' | 'STORAGE_ERROR';

export function createAiFlowHandler(
  args: CreateAiFlowArgs,
  workspacePath?: string
): CreateAiFlowResponse {
  if (!workspacePath) {
    return errorResponse('NO_WORKSPACE', 'No workspace folder opened.', 'Open a project folder first.');
  }

  if (!Array.isArray(args.nodes) || args.nodes.length === 0) {
    return errorResponse('EMPTY_FLOW', 'nodes must contain at least one node.');
  }

  const rawNodes = args.nodes.map(normalizeNode);
  const rawEdges = (args.edges ?? []).map(normalizeEdge);
  const sourceFiles = buildSourceFiles(rawNodes, rawEdges);
  const flowchart = args.flowchartMermaidSource || buildMermaidFlowchart(toMermaidNodes(rawNodes), rawEdges);
  const sequence = args.sequenceMermaidSource || buildMermaidSequence(toMermaidNodes(rawNodes), rawEdges);
  const diagramSources: { type: DiagramType; mermaidSource: string }[] = [
    { type: 'flowchart', mermaidSource: flowchart },
    { type: 'sequence', mermaidSource: sequence },
  ];

  const result = buildFlow(
    rawNodes,
    rawEdges,
    args.prompt,
    sourceFiles,
    diagramSources,
    'success',
    args.warnings
  );

  if (!result.success) {
    return errorResponse('VALIDATION_FAILED', result.errorMessage);
  }

  if (args.title?.trim()) {
    result.flow.title = args.title.trim();
    result.historyEntry.title = result.flow.title;
  }

  try {
    saveFlow(workspacePath, result.flow);
    addHistoryEntry(workspacePath, result.historyEntry);
  } catch (err: any) {
    return errorResponse('STORAGE_ERROR', err.message || String(err));
  }

  return {
    schemaVersion: 1,
    type: 'flow-pilot.flow',
    flowId: result.flow.id,
    title: result.flow.title,
    status: 'success',
    summary: `Saved AI-authored flow with ${result.flow.nodes.length} nodes and ${result.flow.edges.length} relationships.`,
    historySaved: true,
    nodeCount: result.flow.nodes.length,
    edgeCount: result.flow.edges.length,
    sourceFileCount: result.flow.sourceFiles.length,
    diagramTypes: result.flow.diagramTypes,
  };
}

function normalizeNode(node: AiNodeInput): RawNode {
  const lineStart = node.lineStart ?? undefined;
  return {
    id: node.id,
    label: node.label,
    type: node.type || 'process',
    file: node.file || undefined,
    lineStart,
    lineEnd: node.lineEnd ?? lineStart,
    description: node.description,
    symbolName: node.symbolName,
    reason: node.reason,
    confidence: node.confidence,
    evidence: node.evidence,
  };
}

function normalizeEdge(edge: AiEdgeInput): RawEdge {
  return {
    from: edge.from,
    to: edge.to,
    label: edge.label,
    reason: edge.reason,
    confidence: edge.confidence,
    evidence: edge.evidence,
  };
}

function toMermaidNodes(nodes: RawNode[]) {
  return nodes.map((node) => ({
    ...node,
    type: (node.type as any) || 'process',
    file: node.file || null,
    lineStart: node.lineStart || null,
    lineEnd: node.lineEnd || null,
  }));
}

function buildSourceFiles(nodes: RawNode[], edges: RawEdge[]): SourceFile[] {
  const files = new Map<string, string>();
  for (const node of nodes) {
    if (node.file) files.set(node.file, node.reason || `Referenced by node ${node.label}.`);
    for (const evidence of node.evidence ?? []) {
      if (evidence.file) files.set(evidence.file, evidence.reason || `Referenced by node ${node.label}.`);
    }
  }
  for (const edge of edges) {
    for (const evidence of edge.evidence ?? []) {
      if (evidence.file) files.set(evidence.file, evidence.reason || `Referenced by relationship ${edge.from} -> ${edge.to}.`);
    }
  }
  return [...files.entries()].map(([path, reason]) => ({ path, reason }));
}

function errorResponse(
  code: CreateAiFlowErrorCode,
  message: string,
  suggestion?: string
): CreateAiFlowResponse {
  return {
    schemaVersion: 1,
    type: 'flow-pilot.error',
    flowId: null,
    title: null,
    status: 'failed',
    summary: message,
    historySaved: false,
    error: { code, message, suggestion },
  };
}
