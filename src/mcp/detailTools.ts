/**
 * Flow Pilot — MCP detail tool helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadFlow } from '../storage/flowStorage';
import type { Edge, Evidence, Flow, Node } from '../types/flow';

export interface GetNodeDetailArgs {
  flowId: string;
  nodeId: string;
  includeCodeSnippet?: boolean;
}

export interface GetRelationshipDetailArgs {
  flowId: string;
  from: string;
  to: string;
}

interface ErrorPayload {
  code: 'NO_WORKSPACE' | 'FLOW_NOT_FOUND' | 'NODE_NOT_FOUND' | 'RELATIONSHIP_NOT_FOUND' | 'SOURCE_NOT_FOUND' | 'MCP_ERROR';
  message: string;
}

export interface NodeSummary {
  id: string;
  label: string;
  type: Node['type'];
  file: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  symbolName?: string;
  confidence?: number;
}

export type NodeDetailResponse = {
  schemaVersion: 1;
  type: 'flow-pilot.nodeDetail';
  flowId: string;
  node: Node;
  incoming: Array<{ edge: Edge; node: NodeSummary | null }>;
  outgoing: Array<{ edge: Edge; node: NodeSummary | null }>;
  evidence: Evidence[];
  codeSnippet?: string;
} | {
  schemaVersion: 1;
  type: 'flow-pilot.error';
  flowId: string | null;
  nodeId?: string;
  error: ErrorPayload;
};

export type RelationshipDetailResponse = {
  schemaVersion: 1;
  type: 'flow-pilot.relationshipDetail';
  flowId: string;
  relationship: Edge;
  fromNode: NodeSummary | null;
  toNode: NodeSummary | null;
  evidence: Evidence[];
} | {
  schemaVersion: 1;
  type: 'flow-pilot.error';
  flowId: string | null;
  from?: string;
  to?: string;
  error: ErrorPayload;
};

export function getNodeDetailHandler(
  args: GetNodeDetailArgs,
  workspacePath?: string
): NodeDetailResponse {
  if (!workspacePath) {
    return nodeError(args.flowId, args.nodeId, 'NO_WORKSPACE', 'No workspace folder opened.');
  }

  const flow = loadFlow(workspacePath, args.flowId);
  if (!flow) {
    return nodeError(args.flowId, args.nodeId, 'FLOW_NOT_FOUND', `Flow not found: ${args.flowId}`);
  }

  const node = flow.nodes.find((item) => item.id === args.nodeId);
  if (!node) {
    return nodeError(args.flowId, args.nodeId, 'NODE_NOT_FOUND', `Node not found: ${args.nodeId}`);
  }

  const incoming = flow.edges
    .filter((edge) => edge.to === node.id)
    .map((edge) => ({ edge, node: summarizeNode(flow, edge.from) }));
  const outgoing = flow.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => ({ edge, node: summarizeNode(flow, edge.to) }));

  const response: NodeDetailResponse = {
    schemaVersion: 1,
    type: 'flow-pilot.nodeDetail',
    flowId: flow.id,
    node,
    incoming,
    outgoing,
    evidence: node.evidence ?? [],
  };

  if (args.includeCodeSnippet !== false) {
    const snippet = readCodeSnippet(workspacePath, node);
    if (snippet) {
      response.codeSnippet = snippet;
    }
  }

  return response;
}

export function getRelationshipDetailHandler(
  args: GetRelationshipDetailArgs,
  workspacePath?: string
): RelationshipDetailResponse {
  if (!workspacePath) {
    return relationshipError(args.flowId, args.from, args.to, 'NO_WORKSPACE', 'No workspace folder opened.');
  }

  const flow = loadFlow(workspacePath, args.flowId);
  if (!flow) {
    return relationshipError(args.flowId, args.from, args.to, 'FLOW_NOT_FOUND', `Flow not found: ${args.flowId}`);
  }

  const relationship = flow.edges.find((edge) => edge.from === args.from && edge.to === args.to);
  if (!relationship) {
    return relationshipError(
      args.flowId,
      args.from,
      args.to,
      'RELATIONSHIP_NOT_FOUND',
      `Relationship not found: ${args.from} -> ${args.to}`
    );
  }

  return {
    schemaVersion: 1,
    type: 'flow-pilot.relationshipDetail',
    flowId: flow.id,
    relationship,
    fromNode: summarizeNode(flow, relationship.from),
    toNode: summarizeNode(flow, relationship.to),
    evidence: relationship.evidence ?? [],
  };
}

export function readCodeSnippet(workspacePath: string, node: Node): string | undefined {
  if (!node.file || !node.lineStart) return undefined;

  const fullPath = path.resolve(workspacePath, node.file);
  if (!isInsideWorkspace(workspacePath, fullPath)) return undefined;

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const start = Math.max(0, node.lineStart - 1);
    const end = Math.min(lines.length, Math.max(node.lineEnd ?? node.lineStart, node.lineStart));
    return lines.slice(start, end).join('\n');
  } catch {
    return undefined;
  }
}

function summarizeNode(flow: Flow, nodeId: string): NodeSummary | null {
  const node = flow.nodes.find((item) => item.id === nodeId);
  if (!node) return null;

  return {
    id: node.id,
    label: node.label,
    type: node.type,
    file: node.file,
    lineStart: node.lineStart,
    lineEnd: node.lineEnd,
    symbolName: node.symbolName,
    confidence: node.confidence,
  };
}

function nodeError(
  flowId: string | null,
  nodeId: string,
  code: ErrorPayload['code'],
  message: string
): NodeDetailResponse {
  return {
    schemaVersion: 1,
    type: 'flow-pilot.error',
    flowId,
    nodeId,
    error: { code, message },
  };
}

function relationshipError(
  flowId: string | null,
  from: string,
  to: string,
  code: ErrorPayload['code'],
  message: string
): RelationshipDetailResponse {
  return {
    schemaVersion: 1,
    type: 'flow-pilot.error',
    flowId,
    from,
    to,
    error: { code, message },
  };
}

function isInsideWorkspace(workspacePath: string, fullPath: string): boolean {
  const relative = path.relative(path.resolve(workspacePath), fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
