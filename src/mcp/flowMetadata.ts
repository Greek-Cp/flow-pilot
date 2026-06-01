/**
 * Flow Pilot — Flow metadata helpers
 * Builds traceability fields from scanned files and prompt-only fallbacks.
 */

import * as path from 'path';
import type { Evidence, NodeType } from '../types/flow';

export interface SourceMetadata {
  type: NodeType;
  symbolName?: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  reason: string;
  confidence: number;
  evidence: Evidence[];
}

export interface ScannedSourceLike {
  path: string;
  content: string;
  reason: string;
}

interface SymbolMatch {
  symbolName: string;
  type: NodeType;
  lineStart: number;
}

export function buildSourceMetadata(file: ScannedSourceLike): SourceMetadata {
  const lines = file.content.split(/\r?\n/);
  const symbol = findFirstSymbol(lines);
  const fallbackType = guessNodeTypeFromPath(file.path);
  const type = symbol?.type === 'function' || symbol?.type === 'class' || symbol?.type === 'method'
    ? symbol.type
    : fallbackType;
  const lineStart = symbol?.lineStart ?? 1;
  const lineEnd = Math.max(lineStart, estimateLineEnd(lines, lineStart));
  const snippet = lines.slice(lineStart - 1, Math.min(lineEnd, lineStart + 11)).join('\n').trim();
  const symbolName = symbol?.symbolName;
  const basename = path.basename(file.path);
  const reason = file.reason || `Source file ${basename} matched the prompt.`;

  return {
    type,
    symbolName,
    lineStart,
    lineEnd,
    description: symbolName
      ? `${symbolName} in ${file.path}`
      : `Relevant source file ${file.path}`,
    reason,
    confidence: symbolName ? 0.78 : 0.66,
    evidence: [
      {
        kind: symbolName ? 'symbol' : 'file',
        file: file.path,
        lineStart,
        lineEnd,
        symbolName,
        snippet: snippet || undefined,
        reason: symbolName
          ? `Detected symbol ${symbolName} in a file selected by the scanner.`
          : reason,
      },
      {
        kind: 'filename',
        file: file.path,
        reason,
      },
    ],
  };
}

export function conceptualEvidence(prompt: string, reason: string): Evidence[] {
  return [
    {
      kind: 'prompt',
      reason: `${reason} Prompt: ${prompt.substring(0, 180)}`,
    },
  ];
}

export function relationshipEvidence(
  fromLabel: string,
  toLabel: string,
  label: string | undefined,
  sourceBacked: boolean
): { reason: string; confidence: number; evidence: Evidence[] } {
  const reason = label
    ? `${fromLabel} relates to ${toLabel}: ${label}.`
    : `${fromLabel} relates to ${toLabel} in the generated flow.`;

  return {
    reason,
    confidence: sourceBacked ? 0.45 : 0.35,
    evidence: [
      {
        kind: 'relationship',
        reason: sourceBacked
          ? `${reason} Relationship is inferred from scanner relevance order and should be refined by richer analysis.`
          : `${reason} Relationship is conceptual because no source-backed edge evidence was available.`,
      },
    ],
  };
}

export function guessNodeTypeFromPath(filePath: string): NodeType {
  const lower = filePath.toLowerCase();
  if (lower.includes('screen') || lower.includes('page') || lower.includes('view') || lower.includes('widget')) return 'ui';
  if (lower.includes('usecase') || lower.includes('interactor') || lower.includes('operation') || lower.includes('workflow')) return 'process';
  if (lower.includes('controller')) return 'controller';
  if (lower.includes('service')) return 'service';
  if (lower.includes('repository') || lower.includes('repo')) return 'repository';
  if (lower.includes('datasource') || lower.includes('data-source')) return 'datasource';
  if (lower.includes('model') || lower.includes('entity')) return 'model';
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) return 'api';
  if (lower.includes('sdk') || lower.includes('client')) return 'sdk';
  if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) return 'module';
  return 'file';
}

function findFirstSymbol(lines: string[]): SymbolMatch | undefined {
  const patterns: Array<{ type: NodeType; regex: RegExp }> = [
    { type: 'class', regex: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/ },
    { type: 'function', regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
    { type: 'function', regex: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/ },
    { type: 'method', regex: /^\s*(?:public|private|protected|static|async|\s)*\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[:{]/ },
    { type: 'class', regex: /^\s*class\s+([A-Za-z_][\w]*)/ },
    { type: 'function', regex: /^\s*def\s+([A-Za-z_][\w]*)\s*\(/ },
  ];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match?.[1] && !isControlKeyword(match[1])) {
        return {
          symbolName: match[1],
          type: pattern.type,
          lineStart: index + 1,
        };
      }
    }
  }

  return undefined;
}

function estimateLineEnd(lines: string[], lineStart: number): number {
  const startIndex = Math.max(0, lineStart - 1);
  let braceDepth = 0;
  let sawBrace = false;

  for (let index = startIndex; index < Math.min(lines.length, startIndex + 120); index++) {
    const line = lines[index];
    for (const char of line) {
      if (char === '{') {
        braceDepth++;
        sawBrace = true;
      } else if (char === '}') {
        braceDepth--;
      }
    }
    if (sawBrace && braceDepth <= 0 && index > startIndex) {
      return index + 1;
    }
    if (!sawBrace && index >= startIndex + 20) {
      return index + 1;
    }
  }

  return Math.min(lines.length, startIndex + 50);
}

function isControlKeyword(value: string): boolean {
  return ['if', 'for', 'while', 'switch', 'catch', 'return'].includes(value);
}
