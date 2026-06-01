/**
 * Flow Pilot — Generate Flow Tool
 * Main handler for the generate_flow MCP tool
 */

import { scanWorkspace, type ScannedFile } from './codebaseScanner';
import { buildFlow, type RawNode, type RawEdge } from './flowBuilder';
import { buildMermaidFlowchart, buildMermaidSequence } from './mermaidBuilder';
import {
  buildSourceMetadata,
  conceptualEvidence,
  relationshipEvidence,
} from './flowMetadata';
import { saveFlow } from '../storage/flowStorage';
import { addHistoryEntry } from '../storage/historyStorage';
import type { Flow, SourceFile, DiagramType } from '../types/flow';
import type { HistoryEntry } from '../types/history';

export interface GenerateFlowArgs {
  prompt: string;
}

export interface GenerateFlowResponse {
  schemaVersion: 1;
  type: 'flow-pilot.flow' | 'flow-pilot.error';
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
  flow?: Flow;
  historyEntry?: HistoryEntry;
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
      schemaVersion: 1,
      type: 'flow-pilot.error',
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
      schemaVersion: 1,
      type: 'flow-pilot.error',
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
      schemaVersion: 1,
      type: 'flow-pilot.error',
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
  let scannedFiles: ScannedFile[];
  try {
    scannedFiles = await scanWorkspace(prompt, workspacePath);
  } catch (err: any) {
    return {
      schemaVersion: 1,
      type: 'flow-pilot.error',
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

  const isProductFlow = shouldBuildProductFlow(prompt);
  const isPromptOnlyFlow = scannedFiles.length === 0;

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

  let rawNodes: RawNode[];
  let rawEdges: RawEdge[];
  let warnings: string[] | undefined;

  if (isPromptOnlyFlow) {
    const fallback = buildPromptOnlyFlow(prompt);
    rawNodes = fallback.nodes;
    rawEdges = enrichEdges(fallback.edges, rawNodes, false);
    warnings = isProductFlow
      ? ['No matching source files were found, so Flow Pilot generated a conceptual prompt-only flow.']
      : ['No matching source files were found, so Flow Pilot generated a prompt-only flow.'];
  } else {
    rawNodes = scannedFiles.slice(0, 50).map((f, i) => {
      const metadata = buildSourceMetadata(f);
      return {
        id: `file_${i}`,
        label: metadata.symbolName || f.path.split('/').pop() || f.path,
        type: metadata.type,
        file: f.path,
        lineStart: metadata.lineStart,
        lineEnd: metadata.lineEnd,
        description: metadata.description,
        symbolName: metadata.symbolName,
        reason: metadata.reason,
        confidence: metadata.confidence,
        evidence: metadata.evidence,
      };
    });

    rawEdges = [];
    // Create sequential edges between files
    for (let i = 0; i < rawNodes.length - 1; i++) {
      const meta = relationshipEvidence(rawNodes[i].label, rawNodes[i + 1].label, undefined, true);
      rawEdges.push({
        from: rawNodes[i].id,
        to: rawNodes[i + 1].id,
        ...meta,
      });
    }
  }

  const flowStatus: 'success' | 'partial' = isPromptOnlyFlow ? 'partial' : 'success';

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
    flowStatus,
    warnings
  );

  if (!result.success) {
    return {
      schemaVersion: 1,
      type: 'flow-pilot.error',
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
      schemaVersion: 1,
      type: 'flow-pilot.error',
      flowId: result.flow.id,
      title: result.flow.title,
      status: 'failed',
      summary: `Failed to save: ${err.message}`,
      historySaved: false,
      flow: result.flow,
      historyEntry: result.historyEntry,
      error: {
        code: 'STORAGE_ERROR',
        message: `Failed to save flow: ${err.message}`,
      },
    };
  }

  return {
    schemaVersion: 1,
    type: 'flow-pilot.flow',
    flowId: result.flow.id,
    title: result.flow.title,
    status: result.flow.status,
    summary: isPromptOnlyFlow
      ? isProductFlow
        ? `Generated conceptual prompt-only flow with ${rawNodes.length} nodes because no matching source files were found.`
        : `Generated prompt-only flow with ${rawNodes.length} nodes because no matching source files were found.`
      : `Generated flow from ${scannedFiles.length} files with ${rawNodes.length} nodes.`,
    historySaved: true,
    nodeCount: rawNodes.length,
    edgeCount: rawEdges.length,
    sourceFileCount: sourceFiles.length,
    diagramTypes: diagramSources.map((d) => d.type),
    warnings,
    flow: result.flow,
    historyEntry: result.historyEntry,
  };
}

function buildPromptOnlyFlow(prompt: string): { nodes: RawNode[]; edges: RawEdge[] } {
  const lower = prompt.toLowerCase();
  const authLike = /auth|login|register|token|credential|otentikasi|autentikasi|daftar|masuk/.test(lower);
  const notesLike = /note|notes|catatan/.test(lower);

  if (authLike || notesLike) {
    const nodes: RawNode[] = [
      conceptualNode(prompt, 'user', 'User', 'external', 'Actor that starts the flow.'),
      conceptualNode(prompt, 'register_screen', 'Register Screen', 'ui', 'Collects new account data.'),
      conceptualNode(prompt, 'login_screen', 'Login Screen', 'ui', 'Collects credentials.'),
      conceptualNode(prompt, 'auth_api', 'Auth API', 'api', 'Handles register, login, and token validation.'),
      conceptualNode(prompt, 'auth_service', 'Auth Service', 'service', 'Hashes passwords and issues tokens.'),
      conceptualNode(prompt, 'database', 'Database', 'repository', 'Stores users and notes.'),
      conceptualNode(prompt, 'notes_list', 'Notes List', 'ui', 'Shows notes for the authenticated user.'),
      conceptualNode(prompt, 'create_note', 'Create Note', 'ui', 'Submits a new note.'),
      conceptualNode(prompt, 'notes_api', 'Notes API', 'api', 'Reads and writes notes with Bearer token auth.'),
    ];

    const edges: RawEdge[] = [
      { from: 'user', to: 'register_screen', label: 'Open register' },
      { from: 'register_screen', to: 'auth_api', label: 'POST /register' },
      { from: 'auth_api', to: 'auth_service', label: 'Validate and hash' },
      { from: 'auth_service', to: 'database', label: 'Create user' },
      { from: 'user', to: 'login_screen', label: 'Open login' },
      { from: 'login_screen', to: 'auth_api', label: 'POST /login' },
      { from: 'auth_api', to: 'database', label: 'Verify user' },
      { from: 'auth_api', to: 'notes_list', label: 'Return token' },
      { from: 'notes_list', to: 'notes_api', label: 'GET /notes' },
      { from: 'notes_list', to: 'create_note', label: 'Open form' },
      { from: 'create_note', to: 'notes_api', label: 'POST /notes' },
      { from: 'notes_api', to: 'database', label: 'Read or insert note' },
    ];

    return { nodes, edges };
  }

  return {
    nodes: [
      conceptualNode(prompt, 'user', 'User', 'external', 'Actor that starts the requested flow.'),
      conceptualNode(prompt, 'client_ui', 'Client UI', 'ui', 'Collects input and shows results.'),
      conceptualNode(prompt, 'backend_api', 'Backend API', 'api', 'Receives the client request.'),
      conceptualNode(prompt, 'service_layer', 'Service Layer', 'service', 'Applies business rules.'),
      conceptualNode(prompt, 'data_store', 'Data Store', 'repository', 'Persists and retrieves data.'),
    ],
    edges: [
      { from: 'user', to: 'client_ui', label: 'Start' },
      { from: 'client_ui', to: 'backend_api', label: 'Request' },
      { from: 'backend_api', to: 'service_layer', label: 'Process' },
      { from: 'service_layer', to: 'data_store', label: 'Read or write' },
      { from: 'service_layer', to: 'client_ui', label: 'Response' },
    ],
  };
}

function conceptualNode(
  prompt: string,
  id: string,
  label: string,
  type: string,
  description: string
): RawNode {
  const reason = 'Conceptual node derived from prompt because no matching source file was found.';
  return {
    id,
    label,
    type,
    file: undefined,
    lineStart: undefined,
    lineEnd: undefined,
    description,
    reason,
    confidence: 0.35,
    evidence: conceptualEvidence(prompt, reason),
  };
}

function enrichEdges(edges: RawEdge[], nodes: RawNode[], sourceBacked: boolean): RawEdge[] {
  return edges.map((edge) => {
    const fromNode = nodes.find((node) => node.id === edge.from);
    const toNode = nodes.find((node) => node.id === edge.to);
    const meta = relationshipEvidence(
      fromNode?.label ?? edge.from,
      toNode?.label ?? edge.to,
      edge.label,
      sourceBacked
    );
    return {
      ...edge,
      reason: edge.reason ?? meta.reason,
      confidence: edge.confidence ?? meta.confidence,
      evidence: edge.evidence ?? meta.evidence,
    };
  });
}

function shouldBuildProductFlow(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /flow produk|bukan dependency|bukan dependensi|bukan sekadar|fitur otentikasi|auth.*note|login.*note|register.*note|catatan/.test(lower);
}
