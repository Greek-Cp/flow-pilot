/**
 * Flow Pilot — Data Validation
 * Enforces all validation rules from data-model.md
 */

import type { Flow, Node, Edge, NodeType, FlowStatus, DiagramType } from '../types/flow';
import type { HistoryEntry } from '../types/history';

const VALID_NODE_TYPES: readonly NodeType[] = [
  'file', 'function', 'class', 'method', 'module',
  'ui', 'controller', 'service', 'repository',
  'datasource', 'model', 'api', 'sdk', 'external', 'unknown',
];

const VALID_FLOW_STATUSES: readonly FlowStatus[] = ['success', 'failed', 'partial'];
const VALID_DIAGRAM_TYPES: readonly DiagramType[] = ['flowchart', 'sequence'];
const MAX_TITLE_LENGTH = 200;
const MAX_LABEL_LENGTH = 100;
const MAX_EDGE_LABEL_LENGTH = 200;
const MAX_PROMPT_LENGTH = 2000;
const MAX_NODES = 50;
const VALID_EVIDENCE_KINDS = [
  'file', 'symbol', 'snippet', 'filename', 'prompt', 'relationship',
] as const;

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] };

function err(field: string, message: string): ValidationError {
  return { field, message };
}

function fail(...errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

function ok(): ValidationResult {
  return { valid: true };
}

function validateConfidence(
  value: number | undefined,
  field: string,
  errors: ValidationError[]
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    errors.push(err(field, 'confidence must be a number between 0 and 1'));
  }
}

function validateEvidenceArray(
  evidence: Node['evidence'] | Edge['evidence'],
  field: string,
  errors: ValidationError[]
): void {
  if (evidence === undefined) return;
  if (!Array.isArray(evidence)) {
    errors.push(err(field, 'evidence must be an array'));
    return;
  }

  evidence.forEach((item, index) => {
    const prefix = `${field}[${index}]`;
    if (!item || typeof item !== 'object') {
      errors.push(err(prefix, 'evidence item must be an object'));
      return;
    }
    if (!VALID_EVIDENCE_KINDS.includes(item.kind as any)) {
      errors.push(err(`${prefix}.kind`, `kind must be one of: ${VALID_EVIDENCE_KINDS.join(', ')}`));
    }
    if (!item.reason || typeof item.reason !== 'string') {
      errors.push(err(`${prefix}.reason`, 'reason must be a non-empty string'));
    }
    if (item.file !== undefined && typeof item.file !== 'string') {
      errors.push(err(`${prefix}.file`, 'file must be a string when provided'));
    }
    if (item.lineStart !== undefined && (typeof item.lineStart !== 'number' || item.lineStart < 1)) {
      errors.push(err(`${prefix}.lineStart`, 'lineStart must be a number >= 1 when provided'));
    }
    if (item.lineEnd !== undefined && (typeof item.lineEnd !== 'number' || item.lineEnd < 1)) {
      errors.push(err(`${prefix}.lineEnd`, 'lineEnd must be a number >= 1 when provided'));
    }
    if (item.lineStart != null && item.lineEnd != null && item.lineStart > item.lineEnd) {
      errors.push(err(`${prefix}.lineStart/lineEnd`, 'lineStart must be <= lineEnd'));
    }
  });
}

/** Validate a UUID format (basic check) */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Validate a Node object */
export function validateNode(node: Node): ValidationResult {
  const errors: ValidationError[] = [];

  if (!node.id || typeof node.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(node.id)) {
    errors.push(err('node.id', 'id must be non-empty, alphanumeric + underscores/hyphens'));
  }
  if (!node.label || typeof node.label !== 'string') {
    errors.push(err('node.label', 'label must be a non-empty string'));
  } else if (node.label.length > MAX_LABEL_LENGTH) {
    errors.push(err('node.label', `label must be max ${MAX_LABEL_LENGTH} characters`));
  }
  if (!VALID_NODE_TYPES.includes(node.type)) {
    errors.push(err('node.type', `type must be one of: ${VALID_NODE_TYPES.join(', ')}`));
  }
  if (node.file !== null && node.file !== undefined) {
    if (typeof node.file !== 'string') {
      errors.push(err('node.file', 'file must be a string or null'));
    } else if (node.lineStart === null || node.lineStart === undefined ||
               node.lineEnd === null || node.lineEnd === undefined) {
      errors.push(err('node.lineStart/lineEnd', 'if file is set, lineStart and lineEnd must also be set'));
    }
  }
  if (node.lineStart !== null && node.lineStart !== undefined) {
    if (typeof node.lineStart !== 'number' || node.lineStart < 1) {
      errors.push(err('node.lineStart', 'lineStart must be a number >= 1'));
    }
  }
  if (node.lineEnd !== null && node.lineEnd !== undefined) {
    if (typeof node.lineEnd !== 'number') {
      errors.push(err('node.lineEnd', 'lineEnd must be a number'));
    }
  }
  if (node.lineStart != null && node.lineEnd != null && node.lineStart > node.lineEnd) {
    errors.push(err('node.lineStart/lineEnd', 'lineStart must be <= lineEnd'));
  }
  if (node.symbolName !== undefined && typeof node.symbolName !== 'string') {
    errors.push(err('node.symbolName', 'symbolName must be a string when provided'));
  }
  if (node.reason !== undefined && typeof node.reason !== 'string') {
    errors.push(err('node.reason', 'reason must be a string when provided'));
  }
  validateConfidence(node.confidence, 'node.confidence', errors);
  validateEvidenceArray(node.evidence, 'node.evidence', errors);

  return errors.length === 0 ? ok() : fail(...errors);
}

/** Validate an Edge object given the set of valid node IDs */
export function validateEdge(edge: Edge, nodeIds: Set<string>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!edge.from || !nodeIds.has(edge.from)) {
    errors.push(err('edge.from', 'from must reference an existing node ID'));
  }
  if (!edge.to || !nodeIds.has(edge.to)) {
    errors.push(err('edge.to', 'to must reference an existing node ID'));
  }
  if (edge.from === edge.to) {
    errors.push(err('edge', 'self-loops are not allowed (from === to)'));
  }
  if (edge.label && edge.label.length > MAX_EDGE_LABEL_LENGTH) {
    errors.push(err('edge.label', `label must be max ${MAX_EDGE_LABEL_LENGTH} characters`));
  }
  if (edge.reason !== undefined && typeof edge.reason !== 'string') {
    errors.push(err('edge.reason', 'reason must be a string when provided'));
  }
  validateConfidence(edge.confidence, 'edge.confidence', errors);
  validateEvidenceArray(edge.evidence, 'edge.evidence', errors);

  return errors.length === 0 ? ok() : fail(...errors);
}

/** Validate a complete Flow object */
export function validateFlow(flow: Flow): ValidationResult {
  const errors: ValidationError[] = [];

  if (!flow.id || !isValidUUID(flow.id)) {
    errors.push(err('flow.id', 'id must be a valid UUID'));
  }
  if (!flow.title || typeof flow.title !== 'string') {
    errors.push(err('flow.title', 'title must be a non-empty string'));
  } else if (flow.title.length > MAX_TITLE_LENGTH) {
    errors.push(err('flow.title', `title must be max ${MAX_TITLE_LENGTH} characters`));
  }
  if (typeof flow.description !== 'string') {
    errors.push(err('flow.description', 'description must be a string'));
  }
  if (!flow.requestPrompt || typeof flow.requestPrompt !== 'string') {
    errors.push(err('flow.requestPrompt', 'requestPrompt must be a non-empty string'));
  } else if (flow.requestPrompt.length > MAX_PROMPT_LENGTH) {
    errors.push(err('flow.requestPrompt', `requestPrompt must be max ${MAX_PROMPT_LENGTH} characters`));
  }
  if (!VALID_FLOW_STATUSES.includes(flow.status)) {
    errors.push(err('flow.status', `status must be one of: ${VALID_FLOW_STATUSES.join(', ')}`));
  }
  if (!Array.isArray(flow.nodes)) {
    errors.push(err('flow.nodes', 'nodes must be an array'));
  } else if (flow.nodes.length > MAX_NODES) {
    errors.push(err('flow.nodes', `nodes must be <= ${MAX_NODES} (got ${flow.nodes.length})`));
  }
  if (!Array.isArray(flow.edges)) {
    errors.push(err('flow.edges', 'edges must be an array'));
  }
  if (!Array.isArray(flow.diagrams)) {
    errors.push(err('flow.diagrams', 'diagrams must be an array'));
  }
  if (!Array.isArray(flow.sourceFiles)) {
    errors.push(err('flow.sourceFiles', 'sourceFiles must be an array'));
  }
  if (!Array.isArray(flow.diagramTypes)) {
    errors.push(err('flow.diagramTypes', 'diagramTypes must be an array'));
  }

  // Validate each node
  const nodeIds = new Set<string>();
  if (Array.isArray(flow.nodes)) {
    for (const node of flow.nodes) {
      const result = validateNode(node);
      if (!result.valid) {
        errors.push(...result.errors);
      }
      if (nodeIds.has(node.id)) {
        errors.push(err('node.id', `duplicate node id: ${node.id}`));
      }
      nodeIds.add(node.id);
    }
  }

  // Validate each edge
  if (Array.isArray(flow.edges)) {
    for (const edge of flow.edges) {
      const result = validateEdge(edge, nodeIds);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
  }

  // Validate diagrams
  if (Array.isArray(flow.diagrams)) {
    for (const diagram of flow.diagrams) {
      if (!VALID_DIAGRAM_TYPES.includes(diagram.type)) {
        errors.push(err('diagram.type', `diagram type must be one of: ${VALID_DIAGRAM_TYPES.join(', ')}`));
      }
      if (!diagram.mermaidSource || typeof diagram.mermaidSource !== 'string') {
        errors.push(err('diagram.mermaidSource', 'mermaidSource must be a non-empty string'));
      }
    }
  }

  // Timestamp validation
  if (flow.createdAt && flow.updatedAt) {
    if (new Date(flow.createdAt).getTime() > new Date(flow.updatedAt).getTime()) {
      errors.push(err('flow.timestamps', 'createdAt must be <= updatedAt'));
    }
  }

  return errors.length === 0 ? ok() : fail(...errors);
}

/** Validate a HistoryEntry */
export function validateHistoryEntry(entry: HistoryEntry): ValidationResult {
  const errors: ValidationError[] = [];

  if (!entry.flowId || typeof entry.flowId !== 'string') {
    errors.push(err('entry.flowId', 'flowId must be a non-empty string'));
  }
  if (!entry.title || typeof entry.title !== 'string') {
    errors.push(err('entry.title', 'title must be a non-empty string'));
  }
  if (!VALID_FLOW_STATUSES.includes(entry.status)) {
    errors.push(err('entry.status', `status must be one of: ${VALID_FLOW_STATUSES.join(', ')}`));
  }
  if (typeof entry.nodeCount !== 'number' || entry.nodeCount < 0) {
    errors.push(err('entry.nodeCount', 'nodeCount must be a non-negative number'));
  }
  if (typeof entry.edgeCount !== 'number' || entry.edgeCount < 0) {
    errors.push(err('entry.edgeCount', 'edgeCount must be a non-negative number'));
  }

  return errors.length === 0 ? ok() : fail(...errors);
}
