/**
 * Flow Pilot — flow context payload
 * Returns line-numbered snippets so an AI client can decide the actual graph.
 */

import { buildSourceMetadata, type ScannedSourceLike } from './flowMetadata';

export interface FlowContextResponse {
  schemaVersion: 1;
  type: 'flow-pilot.context';
  prompt: string;
  fileCount: number;
  files: Array<{
    path: string;
    reason: string;
    suggestedType: string;
    suggestedSymbol?: string;
    suggestedLineStart: number;
    suggestedLineEnd: number;
    numberedContent: string;
  }>;
  nextStep: string;
}

const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_LINES = 180;

export function buildFlowContextResponse(
  prompt: string,
  files: ScannedSourceLike[]
): FlowContextResponse {
  return {
    schemaVersion: 1,
    type: 'flow-pilot.context',
    prompt,
    fileCount: files.length,
    files: files.slice(0, MAX_CONTEXT_FILES).map((file) => {
      const metadata = buildSourceMetadata(file);
      return {
        path: file.path,
        reason: file.reason,
        suggestedType: metadata.type,
        suggestedSymbol: metadata.symbolName,
        suggestedLineStart: metadata.lineStart,
        suggestedLineEnd: metadata.lineEnd,
        numberedContent: numberLines(file.content, MAX_CONTEXT_LINES),
      };
    }),
    nextStep: 'After understanding the code, call create_ai_flow with AI-decided nodes, edges, file paths, lineStart/lineEnd, reasons, and evidence.',
  };
}

function numberLines(content: string, maxLines: number): string {
  const lines = content.split(/\r?\n/).slice(0, maxLines);
  return lines
    .map((line, index) => `${String(index + 1).padStart(4, ' ')} | ${line}`)
    .join('\n');
}
