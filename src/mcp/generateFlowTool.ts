/**
 * Flow Pilot — Generate Flow Tool
 * Main handler for the generate_flow MCP tool
 */

import { scanWorkspace } from './codebaseScanner';
import { buildFlow, type RawNode, type RawEdge } from './flowBuilder';
import { buildMermaidFlowchart, buildMermaidSequence } from './mermaidBuilder';
import { saveFlow } from '../storage/flowStorage';
import { addHistoryEntry } from '../storage/historyStorage';
import type { SourceFile, DiagramType } from '../types/flow';

export interface GenerateFlowArgs {
  prompt: string;
}

export interface GenerateFlowResponse {
  flowId: string | null;
  title: string | null;
  status: 'success' | 'partial' | 'failed';
  summary: string;
  historySaved: boolean;
  nodeCount?: number;
  edgeCount?: number;
  sourceFileCount?: number;
  diagramTypes?: string[];
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
}

/** Main handler for the generate_flow MCP tool */
export async function generateFlowHandler(
  args: GenerateFlowArgs,
  workspacePath?: string
): Promise<GenerateFlowResponse> {
  const { prompt } = args;

  // Validate prompt
  if (!prompt || prompt.trim().length === 0) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: 'Prompt is empty.',
      historySaved: false,
      error: {
        code: 'EMPTY_PROMPT',
        message: 'prompt must be a non-empty string',
        suggestion: 'Provide a description of the code flow you want to visualize.',
      },
    };
  }

  if (prompt.length > 2000) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: 'Prompt exceeds maximum length.',
      historySaved: false,
      error: {
        code: 'EMPTY_PROMPT',
        message: 'prompt exceeds maximum length of 2000 characters',
      },
    };
  }

  // Check workspace
  if (!workspacePath) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: 'No workspace folder is open.',
      historySaved: false,
      error: {
        code: 'NO_WORKSPACE',
        message: 'No workspace folder opened. Please open a project first.',
      },
    };
  }

  // Scan workspace for relevant files
  let scannedFiles;
  try {
    scannedFiles = await scanWorkspace(prompt, workspacePath);
  } catch (err: any) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: 'Failed to scan workspace.',
      historySaved: false,
      error: {
        code: 'MCP_ERROR',
        message: `Failed to scan workspace: ${err.message}`,
      },
    };
  }

  if (scannedFiles.length === 0) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: 'No relevant files found in the workspace.',
      historySaved: false,
      error: {
        code: 'NO_RELEVANT_FILES',
        message: 'No relevant files found.',
        suggestion: `Try a more specific prompt, e.g.: "Generate ${prompt} from specific_file to another_file"`,
      },
    };
  }

  // Build source files list
  const sourceFiles: SourceFile[] = scannedFiles.map((f) => ({
    path: f.path,
    reason: f.reason,
  }));

  // NOTE: In a real implementation, the AI would analyze the scanned files
  // and produce structured node/edge data. For now, we create a placeholder
  // that demonstrates the pipeline. The actual AI analysis happens via MCP
  // protocol — the tool receives the prompt and the MCP client (AI) provides
  // the structured output back through the tool's response handling.
  //
  // For the extension-side implementation, we provide a basic file-based
  // analysis that creates nodes from the scanned files.

  const rawNodes: RawNode[] = scannedFiles.slice(0, 50).map((f, i) => ({
    id: `file_${i}`,
    label: f.path.split('/').pop() || f.path,
    type: guessNodeType(f.path),
    file: f.path,
    lineStart: 1,
    lineEnd: Math.min(50, f.content.split('\n').length),
    description: f.reason,
  }));

  const rawEdges: RawEdge[] = [];
  // Create sequential edges between files
  for (let i = 0; i < rawNodes.length - 1; i++) {
    rawEdges.push({
      from: rawNodes[i].id,
      to: rawNodes[i + 1].id,
    });
  }

  // Generate Mermaid diagrams
  const mermaidFlowchart = buildMermaidFlowchart(
    rawNodes.map((n) => ({
      ...n,
      type: (n.type as any) || 'unknown',
      file: n.file || null,
      lineStart: n.lineStart || null,
      lineEnd: n.lineEnd || null,
    })),
    rawEdges
  );

  const diagramSources: { type: DiagramType; mermaidSource: string }[] = [
    { type: 'flowchart', mermaidSource: mermaidFlowchart },
  ];

  // Try to generate sequence diagram
  if (rawNodes.length >= 2) {
    const mermaidSequence = buildMermaidSequence(
      rawNodes.map((n) => ({
        ...n,
        type: (n.type as any) || 'unknown',
        file: n.file || null,
        lineStart: n.lineStart || null,
        lineEnd: n.lineEnd || null,
      })),
      rawEdges
    );
    diagramSources.push({ type: 'sequence', mermaidSource: mermaidSequence });
  }

  // Build flow
  const result = buildFlow(
    rawNodes,
    rawEdges,
    prompt,
    sourceFiles,
    diagramSources,
    'success'
  );

  if (!result.success) {
    return {
      flowId: null,
      title: null,
      status: 'failed',
      summary: result.errorMessage,
      historySaved: false,
      error: {
        code: result.errorCode,
        message: result.errorMessage,
      },
    };
  }

  // Save flow and history entry
  try {
    saveFlow(workspacePath, result.flow);
    addHistoryEntry(workspacePath, result.historyEntry);
  } catch (err: any) {
    return {
      flowId: result.flow.id,
      title: result.flow.title,
      status: 'failed',
      summary: `Failed to save: ${err.message}`,
      historySaved: false,
      error: {
        code: 'STORAGE_ERROR',
        message: `Failed to save flow: ${err.message}`,
      },
    };
  }

  return {
    flowId: result.flow.id,
    title: result.flow.title,
    status: 'success',
    summary: `Generated flow from ${scannedFiles.length} files with ${rawNodes.length} nodes.`,
    historySaved: true,
    nodeCount: rawNodes.length,
    edgeCount: rawEdges.length,
    sourceFileCount: sourceFiles.length,
    diagramTypes: diagramSources.map((d) => d.type),
  };
}

/** Guess node type from file path */
function guessNodeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('screen') || lower.includes('page') || lower.includes('view') || lower.includes('widget')) return 'ui';
  if (lower.includes('controller')) return 'controller';
  if (lower.includes('service')) return 'service';
  if (lower.includes('repository') || lower.includes('repo')) return 'repository';
  if (lower.includes('model') || lower.includes('entity')) return 'model';
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) return 'api';
  if (lower.includes('sdk') || lower.includes('client')) return 'sdk';
  return 'unknown';
}
