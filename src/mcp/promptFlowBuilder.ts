/**
 * Flow Pilot — Dynamic prompt-directed flow builder
 *
 * This builder is intentionally domain-agnostic. It turns the files selected by
 * the scanner into a product flow by extracting symbols, classifying them,
 * connecting call references, and adding branch/result nodes from code clues.
 */

import type { RawEdge, RawNode } from './flowBuilder';
import { conceptualEvidence, relationshipEvidence } from './flowMetadata';
import type { NodeType } from '../types/flow';

export interface PromptFlowSourceFile {
  path: string;
  content: string;
  reason: string;
}

export interface PromptDirectedFlow {
  nodes: RawNode[];
  edges: RawEdge[];
  warnings?: string[];
}

interface CandidateSymbol {
  id: string;
  label: string;
  type: NodeType;
  file: string;
  lineStart: number;
  lineEnd: number;
  symbolName: string;
  body: string;
  reason: string;
  confidence: number;
  score: number;
}

interface BranchHint {
  ownerId: string;
  label: string;
  lineStart: number;
  lineEnd: number;
}

const MAX_SYMBOL_NODES = 34;
const MAX_BRANCH_NODES = 10;
const MAX_RESULT_NODES = 8;
const MAX_TOTAL_NODES = 48;

export function buildPromptDirectedFlow(
  prompt: string,
  files: PromptFlowSourceFile[]
): PromptDirectedFlow | null {
  if (files.length === 0) return null;

  const keywords = extractKeywords(prompt);
  const candidates = files.flatMap((file) => extractCandidateSymbols(file, keywords));
  const selected = selectCandidateSymbols(candidates);
  if (selected.length < 2) return null;

  const userNode = buildUserNode(prompt);
  const sourceNodes = selected.map((candidate) => symbolToNode(prompt, candidate));
  const branchNodes: RawNode[] = [];
  const resultNodes: RawNode[] = [];
  const rawEdges: RawEdge[] = [];
  const seenNodeIds = new Set<string>([userNode.id, ...sourceNodes.map((node) => node.id)]);

  const entry = pickEntryNode(sourceNodes);
  if (entry) {
    rawEdges.push(edge([userNode, ...sourceNodes], userNode.id, entry.id, 'starts'));
  }

  rawEdges.push(...inferReferenceEdges(sourceNodes));
  rawEdges.push(...inferLayerEdges(sourceNodes, rawEdges));

  for (const candidate of selected) {
    if (branchNodes.length >= MAX_BRANCH_NODES) break;
    for (const hint of extractBranchHints(candidate).slice(0, 2)) {
      if (branchNodes.length >= MAX_BRANCH_NODES) break;
      const branchId = uniqueId(`${candidate.id}_decision`, seenNodeIds);
      const branchNode: RawNode = {
        id: branchId,
        label: hint.label,
        type: 'decision',
        file: candidate.file,
        lineStart: hint.lineStart,
        lineEnd: hint.lineEnd,
        description: `Branch condition detected in ${candidate.symbolName}.`,
        symbolName: candidate.symbolName,
        reason: `Detected conditional logic in ${candidate.file}.`,
        confidence: 0.74,
        evidence: [{
          kind: 'snippet',
          file: candidate.file,
          lineStart: hint.lineStart,
          lineEnd: hint.lineEnd,
          symbolName: candidate.symbolName,
          snippet: lineSlice(candidate.body, 0, 4),
          reason: `Conditional expression "${hint.label}" was found inside ${candidate.symbolName}.`,
        }],
      };
      branchNodes.push(branchNode);
      rawEdges.push(edge([userNode, ...sourceNodes, ...branchNodes], candidate.id, branchId, 'checks'));
    }
  }

  const allBeforeResults = [userNode, ...sourceNodes, ...branchNodes];
  for (const candidate of selected) {
    if (resultNodes.length >= MAX_RESULT_NODES) break;
    for (const result of inferResultNodes(prompt, candidate, seenNodeIds)) {
      if (resultNodes.length >= MAX_RESULT_NODES) break;
      resultNodes.push(result);
      rawEdges.push(edge([...allBeforeResults, ...resultNodes], candidate.id, result.id, result.type === 'error' ? 'error' : 'success'));
    }
  }

  const nodes = trimNodes([userNode, ...sourceNodes, ...branchNodes, ...resultNodes], rawEdges);
  const edges = dedupeEdges(rawEdges).filter((item) =>
    nodes.some((node) => node.id === item.from) && nodes.some((node) => node.id === item.to)
  );

  if (nodes.length < 2 || edges.length === 0) return null;

  return {
    nodes,
    edges,
    warnings: [
      'Generated a dynamic code flow from scanned source symbols, call references, branch clues, and prompt keywords.',
    ],
  };
}

function buildUserNode(prompt: string): RawNode {
  return {
    id: 'user',
    label: 'User / Actor',
    type: 'external',
    file: undefined,
    lineStart: undefined,
    lineEnd: undefined,
    description: 'Actor or caller that starts the requested flow.',
    reason: 'Flow Pilot adds an actor entry point for every product flow.',
    confidence: 0.7,
    evidence: conceptualEvidence(prompt, 'Actor inferred from the requested use case.'),
  };
}

function extractCandidateSymbols(file: PromptFlowSourceFile, keywords: string[]): CandidateSymbol[] {
  const lines = file.content.split(/\r?\n/);
  const symbols: CandidateSymbol[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = matchSymbol(line);
    if (!match) continue;

    const lineStart = index + 1;
    const lineEnd = estimateSymbolEnd(lines, index);
    const body = lines.slice(index, lineEnd).join('\n');
    const label = buildSymbolLabel(match.name, match.kind, file.path, body);
    const type = inferNodeType(label, file.path, body, match.kind);
    const score = scoreSymbol(file.path, label, body, keywords, type);

    symbols.push({
      id: safeId(`${file.path}_${match.name}_${lineStart}`),
      label,
      type,
      file: file.path,
      lineStart,
      lineEnd,
      symbolName: match.name,
      body,
      reason: `${match.kind} ${match.name} matched the requested flow context.`,
      confidence: score >= 12 ? 0.84 : 0.68,
      score,
    });
  }

  if (symbols.length === 0) {
    const label = file.path.split(/[\\/]/).pop() || file.path;
    symbols.push({
      id: safeId(file.path),
      label,
      type: inferNodeType(label, file.path, file.content, 'file'),
      file: file.path,
      lineStart: 1,
      lineEnd: Math.min(file.content.split(/\r?\n/).length, 80),
      symbolName: label.replace(/\.[^.]+$/, ''),
      body: file.content.slice(0, 8000),
      reason: `File ${file.path} matched the requested flow context.`,
      confidence: 0.58,
      score: scoreSymbol(file.path, label, file.content, keywords, inferNodeType(label, file.path, file.content, 'file')),
    });
  }

  return symbols;
}

function matchSymbol(line: string): { name: string; kind: 'class' | 'function' | 'method' | 'file' } | null {
  const patterns: Array<{ kind: 'class' | 'function' | 'method'; regex: RegExp }> = [
    { kind: 'class', regex: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { kind: 'class', regex: /^\s*(?:public\s+)?(?:final\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { kind: 'function', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
    { kind: 'function', regex: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>?/ },
    { kind: 'function', regex: /^\s*(?:Future<[^>]+>|Future|Stream<[^>]+>|void|int|double|bool|String|dynamic)\s+([A-Za-z_$][\w$]*)\s*\(/ },
    { kind: 'function', regex: /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/ },
    { kind: 'function', regex: /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z_][\w]*)\s*\(/ },
    { kind: 'function', regex: /^\s*fun\s+([A-Za-z_][\w]*)\s*\(/ },
    { kind: 'method', regex: /^\s{2,}(?:Future<[^>]+>|Future|Stream<[^>]+>|void|int|double|bool|String|dynamic)?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:async\s*)?[{:=>]/ },
    { kind: 'method', regex: /^\s*(?:public|private|protected|static|async|override|\s)+\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:[:{]|=>)/ },
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    const name = match?.[1];
    if (name && !isControlKeyword(name)) return { name, kind: pattern.kind };
  }
  return null;
}

function selectCandidateSymbols(candidates: CandidateSymbol[]): CandidateSymbol[] {
  const bestById = new Map<string, CandidateSymbol>();
  for (const candidate of candidates) {
    const key = candidate.id;
    const existing = bestById.get(key);
    if (!existing || candidate.score > existing.score) bestById.set(key, candidate);
  }

  return [...bestById.values()]
    .sort((a, b) => b.score - a.score || a.lineStart - b.lineStart)
    .slice(0, MAX_SYMBOL_NODES)
    .sort((a, b) => layerRank(a.type) - layerRank(b.type) || a.file.localeCompare(b.file) || a.lineStart - b.lineStart);
}

function symbolToNode(prompt: string, candidate: CandidateSymbol): RawNode {
  return {
    id: candidate.id,
    label: candidate.label,
    type: candidate.type,
    file: candidate.file,
    lineStart: candidate.lineStart,
    lineEnd: candidate.lineEnd,
    description: describeNode(candidate),
    symbolName: candidate.symbolName,
    reason: candidate.reason,
    confidence: candidate.confidence,
    evidence: [
      {
        kind: 'symbol',
        file: candidate.file,
        lineStart: candidate.lineStart,
        lineEnd: candidate.lineEnd,
        symbolName: candidate.symbolName,
        snippet: lineSlice(candidate.body, 0, 12),
        reason: `${candidate.symbolName} was selected from source code relevant to: ${prompt.substring(0, 120)}`,
      },
    ],
  };
}

function inferReferenceEdges(nodes: RawNode[]): RawEdge[] {
  const candidates = nodes
    .filter((node) => node.file && node.symbolName)
    .map((node) => ({
      node,
      needles: symbolNeedles(node),
    }));

  const edges: RawEdge[] = [];
  for (const from of candidates) {
    const body = getNodeSnippet(from.node).toLowerCase();
    for (const to of candidates) {
      if (from.node.id === to.node.id) continue;
      if (from.node.file === to.node.file && layerRank(from.node.type as NodeType) > layerRank(to.node.type as NodeType)) continue;
      const matched = to.needles.find((needle) => needle.length >= 3 && body.includes(needle.toLowerCase()));
      if (!matched) continue;
      edges.push(edge(nodes, from.node.id, to.node.id, labelForReference(to.node)));
    }
  }
  return dedupeEdges(edges).slice(0, 44);
}

function inferLayerEdges(nodes: RawNode[], existing: RawEdge[]): RawEdge[] {
  const edges: RawEdge[] = [];
  const connected = new Set(existing.flatMap((item) => [item.from, item.to]));
  const ordered = [...nodes].sort((a, b) =>
    layerRank(a.type as NodeType) - layerRank(b.type as NodeType) ||
    String(a.file || '').localeCompare(String(b.file || '')) ||
    String(a.lineStart || 0).localeCompare(String(b.lineStart || 0))
  );

  for (let index = 0; index < ordered.length - 1; index++) {
    const from = ordered[index];
    const to = ordered[index + 1];
    if (existing.some((edgeItem) => edgeItem.from === from.id && edgeItem.to === to.id)) continue;
    if (connected.has(from.id) && connected.has(to.id) && existing.length >= Math.max(2, ordered.length - 2)) continue;
    edges.push(edge(nodes, from.id, to.id, transitionLabel(from, to)));
  }

  return edges.slice(0, Math.max(0, ordered.length - 1));
}

function extractBranchHints(candidate: CandidateSymbol): BranchHint[] {
  const hints: BranchHint[] = [];
  const lines = candidate.body.split(/\r?\n/);

  lines.forEach((line, index) => {
    const ifMatch = line.match(/\bif\s*\(([^)]+)\)/);
    if (ifMatch?.[1]) {
      hints.push({
        ownerId: candidate.id,
        label: humanizeCondition(ifMatch[1]),
        lineStart: candidate.lineStart + index,
        lineEnd: candidate.lineStart + index,
      });
    }

    const switchMatch = line.match(/\bswitch\s*\(([^)]+)\)/);
    if (switchMatch?.[1]) {
      hints.push({
        ownerId: candidate.id,
        label: `Switch ${humanizeCondition(switchMatch[1])}`,
        lineStart: candidate.lineStart + index,
        lineEnd: candidate.lineStart + index,
      });
    }

    if (/\bcatch\b|\bexcept\b/.test(line)) {
      hints.push({
        ownerId: candidate.id,
        label: 'Error caught?',
        lineStart: candidate.lineStart + index,
        lineEnd: candidate.lineStart + index,
      });
    }
  });

  return hints.slice(0, 3);
}

function inferResultNodes(prompt: string, candidate: CandidateSymbol, seenIds: Set<string>): RawNode[] {
  const body = candidate.body;
  const lower = body.toLowerCase();
  const hasError = /\bthrow\b|\bcatch\b|\bexcept\b|\bleft\s*\(|failure|error|invalid|denied|unauthorized|forbidden|not\s+found/.test(lower);
  const hasSuccess = /\bright\s*\(|success|completed|approved|created|saved|return\s+[^;]+/.test(lower);
  const results: RawNode[] = [];

  if (hasError) {
    results.push(resultNode(prompt, candidate, uniqueId(`${candidate.id}_error`, seenIds), 'error', inferErrorLabel(body)));
  }
  if (hasSuccess) {
    results.push(resultNode(prompt, candidate, uniqueId(`${candidate.id}_success`, seenIds), 'success', inferSuccessLabel(body)));
  }

  return results;
}

function resultNode(prompt: string, candidate: CandidateSymbol, id: string, type: 'success' | 'error', label: string): RawNode {
  return {
    id,
    label,
    type,
    file: candidate.file,
    lineStart: candidate.lineStart,
    lineEnd: candidate.lineEnd,
    description: type === 'error' ? 'Failure or exception path detected in source.' : 'Successful return/result path detected in source.',
    symbolName: candidate.symbolName,
    reason: `${type === 'error' ? 'Failure' : 'Success'} result inferred from ${candidate.symbolName}.`,
    confidence: 0.62,
    evidence: [{
      kind: 'snippet',
      file: candidate.file,
      lineStart: candidate.lineStart,
      lineEnd: candidate.lineEnd,
      symbolName: candidate.symbolName,
      snippet: lineSlice(candidate.body, 0, 12),
      reason: `${type === 'error' ? 'Failure' : 'Success'} clue found while building flow for prompt: ${prompt.substring(0, 120)}`,
    }],
  };
}

function inferNodeType(label: string, filePath: string, body: string, kind: 'class' | 'function' | 'method' | 'file'): NodeType {
  const searchable = `${label} ${humanizeName(label)} ${filePath.replace(/[\\/._-]+/g, ' ')} ${humanizeName(filePath)} ${body.slice(0, 800)}`;
  const lower = searchable.toLowerCase();
  if (/\b(screen|page|view|widget|component|fragment|activity|viewcontroller)\b/.test(lower)) return 'ui';
  if (/\b(route|router|endpoint|api|handler|controller)\b/.test(lower)) return 'api';
  if (/\b(usecase|interactor|workflow|operation|command|job|task)\b/.test(lower)) return 'process';
  if (kind === 'function' || kind === 'method') return 'process';
  if (/\b(service|manager|facade|provider)\b/.test(lower)) return 'service';
  if (/\b(repository|repo)\b/.test(lower)) return 'repository';
  if (/\b(datasource|data-source|database|dao|storage|cache|local|remote|sql|mongo|redis|sharedpreferences)\b/.test(lower)) return 'datasource';
  if (/\b(model|entity|dto|param|payload|request|response|schema)\b/.test(lower)) return 'model';
  if (kind === 'class') return 'class';
  return 'file';
}

function buildSymbolLabel(name: string, kind: string, filePath: string, body: string): string {
  const searchable = `${name} ${humanizeName(name)} ${filePath.replace(/[\\/._-]+/g, ' ')} ${humanizeName(filePath)} ${body.slice(0, 500)}`;
  if (/\b(screen|page|view|widget|component)\b/i.test(searchable)) {
    return humanizeName(name);
  }
  if (kind === 'method' || kind === 'function') return `${name}()`;
  return name;
}

function scoreSymbol(filePath: string, label: string, body: string, keywords: string[], type: NodeType): number {
  const haystack = `${filePath} ${label} ${body}`.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (filePath.toLowerCase().includes(keyword)) score += 7;
    if (label.toLowerCase().includes(keyword)) score += 8;
    if (haystack.includes(keyword)) score += 2;
  }
  if (type === 'ui') score += 8;
  if (type === 'api' || type === 'controller') score += 7;
  if (type === 'process' || type === 'service') score += 6;
  if (type === 'repository' || type === 'datasource') score += 5;
  if (type === 'model') score += 2;
  if (/\b(if|switch|catch|throw|left\(|right\(|failure|success)\b/i.test(body)) score += 5;
  return score;
}

function pickEntryNode(nodes: RawNode[]): RawNode | undefined {
  return nodes.find((node) => node.type === 'ui') ||
    nodes.find((node) => node.type === 'api' || node.type === 'controller') ||
    nodes.find((node) => node.type === 'process' || node.type === 'service') ||
    nodes[0];
}

function trimNodes(nodes: RawNode[], edges: RawEdge[]): RawNode[] {
  const keep = new Set<string>();
  for (const edgeItem of edges) {
    keep.add(edgeItem.from);
    keep.add(edgeItem.to);
  }
  const connected = nodes.filter((node) => keep.has(node.id));
  const result = connected.length >= 2 ? connected : nodes;
  return result.slice(0, MAX_TOTAL_NODES);
}

function edge(nodes: RawNode[], from: string, to: string, label: string): RawEdge {
  const fromNode = nodes.find((item) => item.id === from);
  const toNode = nodes.find((item) => item.id === to);
  const meta = relationshipEvidence(fromNode?.label ?? from, toNode?.label ?? to, label, Boolean(fromNode?.file || toNode?.file));
  return { from, to, label, ...meta };
}

function dedupeEdges(edges: RawEdge[]): RawEdge[] {
  const seen = new Set<string>();
  const deduped: RawEdge[] = [];
  for (const edgeItem of edges) {
    if (edgeItem.from === edgeItem.to) continue;
    const key = `${edgeItem.from}->${edgeItem.to}:${edgeItem.label || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(edgeItem);
  }
  return deduped;
}

function symbolNeedles(node: RawNode): string[] {
  const symbol = node.symbolName || node.label;
  return [
    symbol,
    symbol.replace(/\(\)$/, ''),
    node.label.replace(/\(\)$/, ''),
    humanizeName(symbol).replace(/\s+/g, ''),
  ].filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

function getNodeSnippet(node: RawNode): string {
  const evidence = node.evidence?.find((item) => item.snippet);
  return evidence?.snippet || '';
}

function labelForReference(toNode: RawNode): string {
  if (toNode.type === 'datasource' || toNode.type === 'repository') return 'uses';
  if (toNode.type === 'model') return 'maps data';
  if (toNode.type === 'ui') return 'navigates';
  return `calls ${toNode.symbolName || toNode.label}`;
}

function transitionLabel(from: RawNode, to: RawNode): string {
  if (from.type === 'external') return 'starts';
  if (to.type === 'datasource') return 'read/write data';
  if (to.type === 'repository') return 'delegate data access';
  if (to.type === 'model') return 'build payload';
  if (to.type === 'success') return 'success';
  if (to.type === 'error') return 'failure';
  return 'next';
}

function describeNode(candidate: CandidateSymbol): string {
  switch (candidate.type) {
    case 'ui': return `${candidate.label} collects input or presents output.`;
    case 'api': return `${candidate.label} receives or handles an external request.`;
    case 'process': return `${candidate.label} performs an operation in the requested use case.`;
    case 'repository': return `${candidate.label} coordinates data access.`;
    case 'datasource': return `${candidate.label} reads or writes storage/external data.`;
    case 'model': return `${candidate.label} represents data used by the flow.`;
    default: return `${candidate.label} participates in the requested flow.`;
  }
}

function estimateSymbolEnd(lines: string[], startIndex: number): number {
  let braceDepth = 0;
  let sawBrace = false;
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 140); index++) {
    for (const char of lines[index]) {
      if (char === '{') {
        braceDepth++;
        sawBrace = true;
      } else if (char === '}') {
        braceDepth--;
      }
    }
    if (sawBrace && braceDepth <= 0 && index > startIndex) return index + 1;
    if (!sawBrace && index >= startIndex + 24) return index + 1;
  }
  return Math.min(lines.length, startIndex + 80);
}

function lineSlice(body: string, start: number, count: number): string {
  return body.split(/\r?\n/).slice(start, start + count).join('\n').trim();
}

function layerRank(type: NodeType | string | undefined): number {
  switch (type) {
    case 'external': return 0;
    case 'ui': return 1;
    case 'api':
    case 'controller': return 2;
    case 'process':
    case 'function':
    case 'method':
    case 'service': return 3;
    case 'repository': return 4;
    case 'datasource': return 5;
    case 'model': return 6;
    case 'decision': return 7;
    case 'error': return 8;
    case 'success': return 9;
    default: return 10;
  }
}

function humanizeCondition(condition: string): string {
  return condition
    .replace(/[!]=/g, ' differs from ')
    .replace(/==={0,1}/g, ' equals ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70) || 'Condition met?';
}

function inferErrorLabel(body: string): string {
  const left = body.match(/Left\s*\(([^)\n]+)/i)?.[1];
  if (left) return `Left(${left.trim()})`;
  const failure = body.match(/([A-Za-z_][\w]*(?:Failure|Error|Exception))/)?.[1];
  return failure || 'Error / failure';
}

function inferSuccessLabel(body: string): string {
  const right = body.match(/Right\s*\(([^)\n]+)/i)?.[1];
  if (right) return `Right(${right.trim()})`;
  if (/saved/i.test(body)) return 'Saved successfully';
  if (/completed/i.test(body)) return 'Completed successfully';
  return 'Success result';
}

function extractKeywords(prompt: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'atau', 'dan', 'yang', 'dari', 'sampai', 'untuk', 'dengan',
    'flow', 'alur', 'diagram', 'buat', 'bikin', 'generate', 'show', 'tampilkan',
    'usecase', 'use', 'case', 'fitur', 'aplikasi', 'mobile', 'web', 'simple',
  ]);
  const words = prompt
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((item) => item.toLowerCase())
    .filter((item) => item.length >= 3 && !stopWords.has(item));
  return [...new Set(words)];
}

function safeId(input: string): string {
  const clean = input
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return /^[a-zA-Z_]/.test(clean) ? clean : `n_${clean || 'node'}`;
}

function uniqueId(base: string, seen: Set<string>): string {
  let id = safeId(base);
  let index = 2;
  while (seen.has(id)) {
    id = safeId(`${base}_${index}`);
    index++;
  }
  seen.add(id);
  return id;
}

function humanizeName(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function isControlKeyword(value: string): boolean {
  return ['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'try'].includes(value);
}
