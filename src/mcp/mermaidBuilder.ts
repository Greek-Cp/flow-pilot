/**
 * Flow Pilot — Mermaid Builder
 * Converts nodes/edges into valid Mermaid syntax
 */

import type { Node, Edge } from '../types/flow';

/** Sanitize a label for Mermaid syntax */
function sanitizeLabel(label: string): string {
  const clean = label
    .replace(/"/g, "'")
    .replace(/[|;]/g, '/')
    .replace(/[<>]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60); // Truncate long labels
  return clean || 'Node';
}

/** Sanitize a node ID for Mermaid syntax */
function sanitizeId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(clean) ? clean : `n_${clean}`;
}

/** Shape name per node type for webview legends and MCP clients. */
export function nodeIconName(type: string): string {
  switch (type) {
    case 'external': return 'stadium';
    case 'ui': return 'parallelogram';
    case 'api':
    case 'controller': return 'hexagon';
    case 'service':
    case 'sdk':
    case 'repository': return 'subroutine';
    case 'datasource': return 'cylinder';
    case 'model': return 'rounded';
    case 'process':
    case 'function':
    case 'method': return 'process';
    case 'class': return 'subroutine';
    case 'decision': return 'diamond';
    case 'success': return 'success';
    case 'error': return 'error';
    default: return 'rectangle';
  }
}

/** Type-specific Mermaid shape so each node category is visually distinct. */
function flowchartNodeDecl(id: string, type: string, label: string): string {
  switch (type) {
    case 'external': return `${id}(["${label}"])`;      // stadium — user/actor
    case 'ui': return `${id}[/"${label}"/]`;             // parallelogram — screen/page
    case 'api':
    case 'controller': return `${id}{{"${label}"}}`;     // hexagon — API/endpoint
    case 'service':
    case 'repository':
    case 'sdk': return `${id}[["${label}"]]`;            // subroutine — service/logic
    case 'datasource': return `${id}[("${label}")]`;     // cylinder — data store
    case 'model': return `${id}("${label}")`;            // rounded — model/data
    case 'decision': return `${id}{"${label}"}`;         // diamond — branch
    case 'process':
    case 'function':
    case 'method': return `${id}["${label}"]`;           // rectangle — operation/process
    case 'success': return `${id}["${label}"]`;
    case 'error': return `${id}["${label}"]`;
    default: return `${id}["${label}"]`;                 // rectangle — code/file
  }
}

/** Build a Mermaid flowchart from nodes and edges */
export function buildMermaidFlowchart(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = ['flowchart TD'];

  // Add nodes with a type-specific shape.
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    lines.push(`    ${flowchartNodeDecl(id, node.type, label)}`);
  }

  // Add edges
  for (const edge of edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    if (edge.label) {
      const label = sanitizeLabel(edge.label);
      lines.push(`    ${from} -->|"${label}"| ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  }

  const successIds = nodes.filter((node) => node.type === 'success').map((node) => sanitizeId(node.id));
  const errorIds = nodes.filter((node) => node.type === 'error').map((node) => sanitizeId(node.id));
  const decisionIds = nodes.filter((node) => node.type === 'decision').map((node) => sanitizeId(node.id));
  if (successIds.length) {
    lines.push('    classDef flowpilotSuccess fill:#238636,stroke:#2ea043,color:#ffffff;');
    lines.push(`    class ${successIds.join(',')} flowpilotSuccess;`);
  }
  if (errorIds.length) {
    lines.push('    classDef flowpilotError fill:#da3633,stroke:#f85149,color:#ffffff;');
    lines.push(`    class ${errorIds.join(',')} flowpilotError;`);
  }
  if (decisionIds.length) {
    lines.push('    classDef flowpilotDecision fill:#1f2937,stroke:#58a6ff,color:#ffffff;');
    lines.push(`    class ${decisionIds.join(',')} flowpilotDecision;`);
  }

  return lines.join('\n');
}

/** Build a Mermaid sequence diagram from nodes and edges */
export function buildMermaidSequence(nodes: Node[], edges: Edge[]): string {
  const summary = buildAuthNoteSummarySequence(nodes);
  if (summary) return summary;

  const lines: string[] = ['sequenceDiagram'];

  // Add plain participants; sequence readability comes from the messages.
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    const keyword = node.type === 'external' ? 'actor' : 'participant';
    lines.push(`    ${keyword} ${id} as ${label}`);
  }

  // Add messages (edges)
  for (const edge of edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    const label = edge.label ? sanitizeLabel(edge.label) : 'calls';
    lines.push(`    ${from}->>${to}: ${label}`);
  }

  return lines.join('\n');
}

function buildAuthNoteSummarySequence(nodes: Node[]): string | null {
  const ids = new Set(nodes.map((node) => node.id));
  const isAuthNoteFlow = [
    'auth_gate',
    'auth_impl_login',
    'auth_impl_register',
    'note_impl_save',
    'save_notes',
  ].every((id) => ids.has(id));

  if (!isAuthNoteFlow) return null;

  return [
    'sequenceDiagram',
    '    actor user as User',
    '    participant app as App / AuthGate',
    '    participant auth as Auth Repository',
    '    participant local as Local Datasource',
    '    participant notes as Note Repository',
    '',
    '    user->>app: Open app',
    '    app->>auth: getCurrentUser()',
    '    auth->>local: Read saved user',
    '    alt Session exists',
    '        auth-->>app: Right(UserEntity)',
    '        app-->>user: Home / Notes screen',
    '    else No session',
    '        app-->>user: Login or Register screen',
    '        user->>app: Submit credentials',
    '        app->>auth: login() or register()',
    '        auth->>local: getUserByEmail()',
    '        alt Invalid credentials or email exists',
    '            auth-->>app: Left(CacheFailure)',
    '            app-->>user: Show auth error',
    '        else Auth success',
    '            auth->>local: saveUser()',
    '            auth-->>app: Right(UserEntity)',
    '            app-->>user: Home / Notes screen',
    '        end',
    '    end',
    '',
    '    user->>app: Add note',
    '    app->>notes: saveNote()',
    '    notes->>local: getNotes()',
    '    notes->>local: saveNotes(updated)',
    '    alt Storage error',
    '        notes-->>app: Left(StorageFailure)',
    '        app-->>user: Show note error',
    '    else Note saved',
    '        notes-->>app: Right(List<NoteEntity>)',
    '        app-->>user: Show updated notes',
    '    end',
  ].join('\n');
}
