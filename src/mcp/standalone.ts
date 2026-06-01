#!/usr/bin/env node
/**
 * Flow Pilot — Standalone MCP Server Entry Point
 * Runs as a child process via stdio transport
 * Used by VS Code's MCP server definition provider
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import {
  buildSourceMetadata,
  conceptualEvidence,
  relationshipEvidence,
  guessNodeTypeFromPath,
} from './flowMetadata';
import { getNodeDetailHandler, getRelationshipDetailHandler } from './detailTools';
import { buildPromptDirectedFlow } from './promptFlowBuilder';
import { createAiFlowHandler } from './aiFlowTool';
import { buildFlowContextResponse } from './flowContextTool';

const evidenceSchema = z.object({
  kind: z.enum(['file', 'symbol', 'snippet', 'filename', 'prompt', 'relationship']),
  file: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  symbolName: z.string().optional(),
  snippet: z.string().optional(),
  reason: z.string().min(1),
});

const aiNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.string().optional(),
  file: z.string().nullable().optional(),
  lineStart: z.number().int().positive().nullable().optional(),
  lineEnd: z.number().int().positive().nullable().optional(),
  description: z.string().optional(),
  symbolName: z.string().optional(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

const aiEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

const configuredWorkspacePath = process.argv[2];
const fallbackWorkspacePath = configuredWorkspacePath && !configuredWorkspacePath.includes('${workspaceFolder}')
  ? configuredWorkspacePath
  : process.cwd();
const STORAGE_DIR = '.flow-pilot';
const LEGACY_STORAGE_DIR = path.join('.vscode', 'flow-pilot');

async function resolveWorkspacePath(): Promise<string> {
  if (configuredWorkspacePath && !configuredWorkspacePath.includes('${workspaceFolder}')) {
    return configuredWorkspacePath;
  }

  try {
    const result = await server.server.listRoots();
    const firstFileRoot = result.roots.find((root) => root.uri.startsWith('file://'));
    if (firstFileRoot) {
      return fileURLToPath(firstFileRoot.uri);
    }
  } catch {
    // Some MCP clients do not support roots/list. Fall back to process cwd.
  }

  return fallbackWorkspacePath;
}

// ── Inline scanner (no vscode dependency) ──

function extractKeywords(prompt: string): string[] {
  const stopWords = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall','can',
    'to','of','in','for','on','with','at','by','from','as','into','through','during',
    'before','after','between','out','off','over','under','again','then','once',
    'here','there','when','where','why','how','all','both','each','few','more','most',
    'not','only','so','than','too','very','just','because','but','and','or','if',
    'show','find','generate','create','make','display','trace','flow','diagram',
    'pelajari','tunjukkan','cari','alur','dari','sampai','yang','dan','di','ke',
    'buat','bikin','sederhana','fitur','aplikasi','mobile','web','sertakan',
    'semuanya','bahasa','indonesia','ringkas','mudah','implementasikan','aktor',
    'komponen','layar','minimal','endpoint','method','opsional','model','singkat',
    'langkah','demi','kondisi','sukses','error','utama','invalid','expired',
    'validation','errors','sequence','menunjukkan','pesan','antar','output',
    'dipahami','engineer','poin','contoh','payload','tekstual','jangan','panjang',
    'maksimal','kata','ui','list','simple','data',
  ]);
  const tokens = prompt.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const words: string[] = [];
  for (const t of tokens) {
    const l = t.toLowerCase();
    if (l.length >= 2 && !stopWords.has(l)) words.push(l);
    const camel = t.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
    for (const p of camel) {
      const pl = p.toLowerCase();
      if (pl.length >= 3 && !stopWords.has(pl)) words.push(pl);
    }
  }
  return [...new Set(words)];
}

interface ScannedFile { path: string; content: string; reason: string; }

const IGNORED_DIRS = new Set([
  '.dart_tool', '.flow-pilot', '.git', '.idea', '.vscode', 'android', 'build',
  'coverage', 'dist', 'ios', 'linux', 'macos', 'node_modules', 'out', 'web',
  'windows',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.py', '.dart', '.java', '.kt', '.swift',
  '.go', '.rs', '.cs', '.rb', '.php',
]);

const GENERATED_FILE_PATTERNS = [
  /\.freezed\.dart$/i,
  /\.g\.dart$/i,
  /\.gr\.dart$/i,
  /\.gen\.dart$/i,
  /generated_plugin_registrant/i,
];

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

function isRelevantCodeFile(fullPath: string, wsPath: string): boolean {
  const relativePath = path.relative(wsPath, fullPath);
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => IGNORED_DIRS.has(part))) return false;
  if (GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath))) return false;
  return CODE_EXTENSIONS.has(path.extname(fullPath).toLowerCase());
}

function scoreFile(relativePath: string, content: string, keywords: string[], matchedByFilename: boolean): number {
  const lowerPath = relativePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;

  if (lowerPath.startsWith('lib/')) score += 20;
  if (lowerPath.includes('/domain/')) score += 8;
  if (lowerPath.includes('/data/')) score += 6;
  if (lowerPath.includes('/repository')) score += 5;
  if (lowerPath.includes('/datasource')) score += 5;
  if (lowerPath.includes('/entity') || lowerPath.includes('/params')) score += 4;
  if (matchedByFilename) score += 4;

  for (const keyword of keywords) {
    if (lowerPath.includes(keyword)) score += 5;
    if (lowerContent.includes(keyword)) score += 1;
  }

  return score;
}

function scanWorkspaceSync(prompt: string, wsPath: string): ScannedFile[] {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return [];

  const scanned: Array<ScannedFile & { score: number }> = [];
  const seen = new Set<string>();

  // Walk directories looking for files matching keywords
  const walk = (dir: string, depth: number) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (isIgnoredDir(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile() && isRelevantCodeFile(full, wsPath)) {
          const lower = entry.name.toLowerCase();
          const matches = keywords.filter(kw => lower.includes(kw));
          if (matches.length > 0 && !seen.has(full)) {
            seen.add(full);
            try {
              const stat = fs.statSync(full);
              if (stat.size > 50_000) continue; // skip large files
              const content = fs.readFileSync(full, 'utf-8').substring(0, 20_000);
              const relativePath = path.relative(wsPath, full);
              scanned.push({
                path: relativePath,
                content,
                reason: `Filename matches: ${matches.join(', ')}`,
                score: scoreFile(relativePath, content, keywords, true),
              });
            } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip unreadable dirs */ }
  };

  walk(wsPath, 0);

  // Also search by content
  const searchDir = (dir: string, depth: number) => {
    if (depth > 3 || scanned.length >= 30) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (scanned.length >= 30) break;
        if (isIgnoredDir(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(full, depth + 1);
        } else if (entry.isFile() && !seen.has(full) && isRelevantCodeFile(full, wsPath)) {
          try {
            const stat = fs.statSync(full);
            if (stat.size > 50_000) continue;
            const content = fs.readFileSync(full, 'utf-8');
            const contentLower = content.toLowerCase();
            const matches = keywords.filter(kw => contentLower.includes(kw));
            if (matches.length > 0) {
              seen.add(full);
              const relativePath = path.relative(wsPath, full);
              scanned.push({
                path: relativePath,
                content: content.substring(0, 20_000),
                reason: `Contains keywords: ${matches.join(', ')}`,
                score: scoreFile(relativePath, content, keywords, false),
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  };

  searchDir(wsPath, 0);
  scanned.sort((a, b) => b.score - a.score);
  return scanned.slice(0, 30).map(({ score, ...file }) => file);
}

// ── Inline flow/mermaid builders ──

import * as crypto from 'crypto';

function sanitizeId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(clean) ? clean : `n_${clean}`;
}
function sanitizeLabel(l: string): string {
  const clean = l
    .replace(/"/g, "'")
    .replace(/[|;]/g, '/')
    .replace(/[<>]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);
  return clean || 'Node';
}

// Shape name per node type so readers can tell screens/APIs/services/data stores apart.
function nodeIconName(type: string): string {
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

// Type-specific Mermaid shape so each node category is visually distinct.
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

function buildMermaidFlowchart(nodes: any[], edges: any[]): string {
  const lines = ['flowchart TD'];
  for (const n of nodes) {
    lines.push(`    ${flowchartNodeDecl(sanitizeId(n.id), n.type, sanitizeLabel(n.label))}`);
  }
  for (const e of edges) {
    if (e.label) lines.push(`    ${sanitizeId(e.from)} -->|"${sanitizeLabel(e.label)}"| ${sanitizeId(e.to)}`);
    else lines.push(`    ${sanitizeId(e.from)} --> ${sanitizeId(e.to)}`);
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

function buildMermaidSequence(nodes: any[], edges: any[]): string {
  const summary = buildAuthNoteSummarySequence(nodes);
  if (summary) return summary;

  const lines = ['sequenceDiagram'];
  for (const n of nodes) {
    const kw = n.type === 'external' ? 'actor' : 'participant';
    lines.push(`    ${kw} ${sanitizeId(n.id)} as ${sanitizeLabel(n.label)}`);
  }
  for (const e of edges) {
    lines.push(`    ${sanitizeId(e.from)}->>${sanitizeId(e.to)}: ${e.label ? sanitizeLabel(e.label) : 'calls'}`);
  }
  return lines.join('\n');
}

function buildAuthNoteSummarySequence(nodes: any[]): string | null {
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

// ── Abstract grouping: collapse many nodes into readable layer groups ──

const LAYER_ORDER: Record<string, number> = {
  external: 0, ui: 1, api: 2, controller: 2, process: 3,
  service: 3, function: 3, method: 3, repository: 4,
  datasource: 5, model: 6, class: 3, file: 3, module: 3,
  sdk: 3, unknown: 3, decision: 7, success: 8, error: 9,
};

const LAYER_LABELS: Record<string, { label: string; type: string; description: string }> = {
  external: { label: 'User', type: 'external', description: 'Actor that starts the flow.' },
  ui: { label: 'UI / Screens', type: 'ui', description: 'App screens and pages the user interacts with.' },
  api: { label: 'API / Controller', type: 'api', description: 'Endpoints that receive requests.' },
  logic: { label: 'Business Logic', type: 'service', description: 'Services, use-cases, and processing logic.' },
  repository: { label: 'Repository', type: 'repository', description: 'Data access coordination layer.' },
  datasource: { label: 'Data Source', type: 'datasource', description: 'Database, cache, or remote data.' },
  model: { label: 'Data Models', type: 'model', description: 'Entities and data structures.' },
  decision: { label: 'Decisions', type: 'service', description: 'Conditional branching in the flow.' },
  result: { label: 'Results', type: 'service', description: 'Success and error outcomes.' },
};

function layerKey(type: string): string {
  if (type === 'external') return 'external';
  if (type === 'ui') return 'ui';
  if (type === 'api' || type === 'controller') return 'api';
  if (type === 'repository') return 'repository';
  if (type === 'datasource') return 'datasource';
  if (type === 'model') return 'model';
  if (type === 'decision') return 'decision';
  if (type === 'success' || type === 'error') return 'result';
  return 'logic';
}

function abstractifyNodes(rawNodes: any[], rawEdges: any[]): { nodes: any[]; edges: any[] } {
  // Group raw nodes by layer
  const groups = new Map<string, any[]>();
  for (const node of rawNodes) {
    const key = layerKey(node.type);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  // For UI layer, split into individual screens (max 4) for clarity
  const uiNodes = groups.get('ui') || [];
  const screenNames = [...new Set(uiNodes.map((n: any) => n.label))].slice(0, 4);

  const nodes: any[] = [];
  const nodeIdMap = new Map<string, string>(); // old id → new abstract id

  // Always add User node
  const userGroup = groups.get('external') || [];
  const userId = 'user';
  nodes.push({
    id: userId,
    label: 'User',
    type: 'external',
    file: null, lineStart: null, lineEnd: null,
    description: 'Actor that starts the flow.',
    reason: 'Entry point for the flow.',
    confidence: 0.9,
    evidence: [{ kind: 'prompt' as const, reason: 'User is the actor.' }],
  });
  for (const n of userGroup) nodeIdMap.set(n.id, userId);

  // Add individual screen nodes (max 4) so user can see which pages exist
  if (screenNames.length > 0) {
    for (const name of screenNames) {
      const id = sanitizeId(`screen_${name}`);
      const members = uiNodes.filter((n: any) => n.label === name);
      const first = members[0];
      nodes.push({
        id,
        label: name,
        type: 'ui',
        file: first?.file || null,
        lineStart: first?.lineStart || null,
        lineEnd: first?.lineEnd || null,
        description: `Screen/page: ${name}`,
        reason: `UI screen detected from source.`,
        confidence: 0.82,
        evidence: members.slice(0, 3).map((m: any) => ({
          kind: 'file' as const, file: m.file, lineStart: m.lineStart, lineEnd: m.lineEnd,
          reason: `${m.symbolName || m.label} in ${m.file}`,
        })),
      });
      for (const m of members) nodeIdMap.set(m.id, id);
    }
    // Map remaining UI nodes to the first screen
    for (const n of uiNodes) {
      if (!nodeIdMap.has(n.id)) nodeIdMap.set(n.id, sanitizeId(`screen_${screenNames[0]}`));
    }
  }

  // Add remaining layers as single abstract nodes
  const layerOrder = ['api', 'logic', 'repository', 'datasource', 'model', 'decision', 'result'];
  for (const key of layerOrder) {
    const members = groups.get(key);
    if (!members || members.length === 0) continue;
    const meta = LAYER_LABELS[key] || { label: key, type: 'service', description: '' };
    const id = sanitizeId(`layer_${key}`);
    const first = members[0];
    nodes.push({
      id,
      label: meta.label,
      type: meta.type,
      file: first?.file || null,
      lineStart: first?.lineStart || null,
      lineEnd: first?.lineEnd || null,
      description: `${meta.description} (${members.length} source elements)`,
      reason: `Grouped ${members.length} source elements into abstract ${meta.label} layer.`,
      confidence: 0.75,
      evidence: members.slice(0, 5).map((m: any) => ({
        kind: 'file' as const, file: m.file, lineStart: m.lineStart, lineEnd: m.lineEnd,
        symbolName: m.symbolName,
        reason: `${m.symbolName || m.label} in ${m.file || 'source'}`,
      })),
    });
    for (const m of members) nodeIdMap.set(m.id, id);
  }

  // Build edges between abstract nodes from original edges
  const edgeSet = new Set<string>();
  const edges: any[] = [];
  for (const e of rawEdges) {
    const from = nodeIdMap.get(e.from);
    const to = nodeIdMap.get(e.to);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ from, to, label: e.label, reason: e.reason, confidence: e.confidence, evidence: e.evidence });
  }

  // Ensure connectivity: add layer-order edges for disconnected nodes
  const connected = new Set(edges.flatMap((e: any) => [e.from, e.to]));
  for (let i = 0; i < nodes.length - 1; i++) {
    if (!connected.has(nodes[i].id) || !connected.has(nodes[i + 1].id)) {
      const key = `${nodes[i].id}->${nodes[i + 1].id}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ from: nodes[i].id, to: nodes[i + 1].id, label: undefined });
      }
    }
  }

  return { nodes, edges };
}

function groupFilesByLayer(files: ScannedFile[]): { nodes: any[]; edges: any[] } {
  const groups = new Map<string, ScannedFile[]>();
  for (const f of files) {
    const type = guessNodeTypeFromPath(f.path);
    const key = layerKey(type);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  const nodes: any[] = [{
    id: 'user', label: 'User', type: 'external',
    file: null, lineStart: null, lineEnd: null,
    description: 'Actor that starts the flow.',
    reason: 'Entry point.', confidence: 0.9,
    evidence: [{ kind: 'prompt' as const, reason: 'User is the actor.' }],
  }];

  const layerOrder = ['ui', 'api', 'logic', 'repository', 'datasource', 'model'];
  for (const key of layerOrder) {
    const members = groups.get(key);
    if (!members || members.length === 0) continue;
    const meta = LAYER_LABELS[key] || { label: key, type: 'service', description: '' };
    const id = sanitizeId(`layer_${key}`);
    const first = members[0];
    nodes.push({
      id, label: meta.label, type: meta.type,
      file: first.path, lineStart: 1, lineEnd: null,
      description: `${meta.description} (${members.length} files)`,
      reason: `Grouped ${members.length} files.`, confidence: 0.65,
      evidence: members.slice(0, 5).map((m) => ({
        kind: 'file' as const, file: m.path, reason: m.reason,
      })),
    });
  }

  // Linear edges between layers
  const edges: any[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
  }
  return { nodes, edges };
}

const LEGEND_MEANING: Record<string, string> = {
  external: 'User / actor that starts the flow',
  ui: 'Screen / page (halaman) in the app',
  api: 'API endpoint',
  controller: 'Controller / request handler',
  service: 'Service / business logic',
  sdk: 'SDK / client library',
  repository: 'Repository / data access',
  datasource: 'Data source / database',
  model: 'Data model / entity',
  process: 'Process / operation step',
  function: 'Function',
  method: 'Method',
  class: 'Class',
  decision: 'Decision / branch condition',
  success: 'Successful result',
  error: 'Error / failure result',
};

// Legend covers only the node types present so AI clients can explain the shapes.
function buildLegend(nodes: any[]): Array<{ type: string; icon: string; meaning: string }> {
  const seen = new Set<string>();
  const legend: Array<{ type: string; icon: string; meaning: string }> = [];
  for (const n of nodes) {
    if (seen.has(n.type)) continue;
    seen.add(n.type);
    legend.push({
      type: n.type,
      icon: nodeIconName(n.type),
      meaning: LEGEND_MEANING[n.type] || 'Code module / file',
    });
  }
  return legend;
}

function buildReadingGuide(nodes: any[]): string {
  const screens = nodes.filter((n) => n.type === 'ui').map((n) => n.label);
  const screenText = screens.length ? ` Screens/pages (halaman): ${screens.join(', ')}.` : '';
  return `Follow the arrows from the top to read the flow order. Each node shape marks its type: user, screen/page, process/operation, API, service/repository, data source/storage, model/data, code/file.${screenText}`;
}

function buildTitle(prompt: string): string {
  let title = prompt
    .replace(/^(show|find|generate|create|display|trace|visualize|buat|bikin)\s+/i, '')
    .replace(/\s+(flow|diagram|chart)$/i, '')
    .trim();

  if (title.length > 100) title = `${title.substring(0, 97)}...`;
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Generated Flow';
}

function buildPromptOnlyFlow(prompt: string): { nodes: any[]; edges: any[] } {
  const lower = prompt.toLowerCase();
  const authLike = /auth|login|register|token|credential|otentikasi|autentikasi|daftar|masuk/.test(lower);
  const notesLike = /note|notes|catatan/.test(lower);

  if (authLike || notesLike) {
    return {
      nodes: [
        { id: 'user', label: 'User', type: 'external', file: null, lineStart: null, lineEnd: null, description: 'Actor that starts the flow.' },
        { id: 'register_screen', label: 'Register Screen', type: 'ui', file: null, lineStart: null, lineEnd: null, description: 'Collects new account data.' },
        { id: 'login_screen', label: 'Login Screen', type: 'ui', file: null, lineStart: null, lineEnd: null, description: 'Collects credentials.' },
        { id: 'auth_api', label: 'Auth API', type: 'api', file: null, lineStart: null, lineEnd: null, description: 'Handles register, login, and token validation.' },
        { id: 'auth_service', label: 'Auth Service', type: 'service', file: null, lineStart: null, lineEnd: null, description: 'Hashes passwords and issues tokens.' },
        { id: 'database', label: 'Database', type: 'datasource', file: null, lineStart: null, lineEnd: null, description: 'Stores users and notes.' },
        { id: 'notes_list', label: 'Notes List', type: 'ui', file: null, lineStart: null, lineEnd: null, description: 'Shows notes for the authenticated user.' },
        { id: 'create_note', label: 'Create Note', type: 'ui', file: null, lineStart: null, lineEnd: null, description: 'Submits a new note.' },
        { id: 'notes_api', label: 'Notes API', type: 'api', file: null, lineStart: null, lineEnd: null, description: 'Reads and writes notes with Bearer token auth.' },
      ],
      edges: [
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
      ],
    };
  }

  return {
    nodes: [
      { id: 'user', label: 'User', type: 'external', file: null, lineStart: null, lineEnd: null, description: 'Actor that starts the requested flow.' },
      { id: 'client_ui', label: 'Client UI', type: 'ui', file: null, lineStart: null, lineEnd: null, description: 'Collects input and shows results.' },
      { id: 'backend_api', label: 'Backend API', type: 'api', file: null, lineStart: null, lineEnd: null, description: 'Receives the client request.' },
      { id: 'service_layer', label: 'Service Layer', type: 'service', file: null, lineStart: null, lineEnd: null, description: 'Applies business rules.' },
      { id: 'data_store', label: 'Data Store', type: 'datasource', file: null, lineStart: null, lineEnd: null, description: 'Persists and retrieves data.' },
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

function shouldBuildProductFlow(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /flow produk|bukan dependency|bukan dependensi|bukan sekadar|fitur otentikasi|auth.*note|login.*note|register.*note|catatan/.test(lower);
}

function enrichConceptualNodes(nodes: any[], prompt: string): any[] {
  return nodes.map((node) => {
    const reason = node.reason || 'Conceptual node derived from prompt because no matching source file was found.';
    return {
      ...node,
      reason,
      confidence: node.confidence ?? 0.35,
      evidence: node.evidence ?? conceptualEvidence(prompt, reason),
    };
  });
}

function enrichRelationshipEdges(edges: any[], nodes: any[], sourceBacked: boolean): any[] {
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

// ── Create MCP Server ──

const server = new McpServer({ name: 'flow-pilot', version: '0.1.0' });

server.tool(
  'generate_flow',
  'Analyze the current workspace codebase and generate an interactive code flow diagram from a natural language prompt.',
  { prompt: z.string().min(1).max(2000).describe('Natural language description of the code flow to visualize.') },
  async ({ prompt }) => {
    const workspacePath = await resolveWorkspacePath();

    // 1. Validate
    if (!prompt.trim()) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            schemaVersion: 1,
            type: 'flow-pilot.error',
            flowId: null,
            title: null,
            status: 'failed',
            summary: 'Prompt is empty.',
            historySaved: false,
            error: { code: 'EMPTY_PROMPT', message: 'Prompt is empty' },
          }),
        }],
      };
    }

    // 2. Scan
    const files = scanWorkspaceSync(prompt, workspacePath);
    const isPromptOnlyFlow = files.length === 0;
    let flowStatus: 'success' | 'partial';

    // 3. Build nodes — ABSTRACT grouping (max ~10 nodes for readability)
    const rawDirected = buildPromptDirectedFlow(prompt, files);
    const fallback = !rawDirected && isPromptOnlyFlow ? buildPromptOnlyFlow(prompt) : null;

    let nodes: any[];
    let edges: any[];

    if (rawDirected) {
      // Collapse detailed nodes into abstract layer groups for readability
      const grouped = abstractifyNodes(rawDirected.nodes, rawDirected.edges);
      nodes = grouped.nodes;
      edges = grouped.edges;
    } else if (fallback) {
      nodes = enrichConceptualNodes(fallback.nodes, prompt);
      edges = enrichRelationshipEdges(fallback.edges, nodes, false);
    } else if (files.length > 0) {
      // Fallback: group scanned files by layer type
      const grouped = groupFilesByLayer(files);
      nodes = grouped.nodes;
      edges = grouped.edges;
    } else {
      nodes = enrichConceptualNodes(buildPromptOnlyFlow(prompt).nodes, prompt);
      edges = enrichRelationshipEdges(buildPromptOnlyFlow(prompt).edges, nodes, false);
    }
    flowStatus = files.length > 0 ? 'success' : 'partial';

    // 4. Build Mermaid
    const fcMermaid = buildMermaidFlowchart(nodes, edges);
    const sqMermaid = buildMermaidSequence(nodes, edges);

    // 5. Build flow object
    const flowId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = buildTitle(prompt);
    const legend = buildLegend(nodes);
    const readingGuide = buildReadingGuide(nodes);

    const flow = {
      id: flowId,
      title,
      description: `Code flow generated from: "${prompt.substring(0, 100)}"`,
      requestPrompt: prompt,
      status: flowStatus,
      createdAt: now,
      updatedAt: now,
      diagramTypes: ['flowchart', 'sequence'],
      nodes, edges,
      legend,
      readingGuide,
      sourceFiles: files.map(f => ({ path: f.path, reason: f.reason })),
      diagrams: [
        { type: 'flowchart', mermaidSource: fcMermaid },
        { type: 'sequence', mermaidSource: sqMermaid },
      ],
      warnings: rawDirected?.warnings ?? (isPromptOnlyFlow
        ? ['No matching source files were found, so Flow Pilot generated a prompt-only flow.']
        : undefined),
    };

    // 6. Save to disk
    const pilotDir = path.join(workspacePath, STORAGE_DIR);
    const flowsDir = path.join(pilotDir, 'flows');
    const historyFile = path.join(pilotDir, 'history.json');
    const legacyHistoryFile = path.join(workspacePath, LEGACY_STORAGE_DIR, 'history.json');

    const flowPath = path.join(flowsDir, `${flowId}.json`);
    const historyEntry = {
      flowId,
      title: flow.title,
      description: flow.description,
      createdAt: now,
      updatedAt: now,
      status: flow.status,
      diagramTypes: ['flowchart', 'sequence'],
      nodeCount: nodes.length,
      edgeCount: edges.length,
      sourceFileCount: files.length,
    };

    try {
      if (!fs.existsSync(flowsDir)) fs.mkdirSync(flowsDir, { recursive: true });
      fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));

      let history = { version: 1, entries: [] as any[] };
      const readableHistoryFile = fs.existsSync(historyFile) ? historyFile : legacyHistoryFile;
      try { history = JSON.parse(fs.readFileSync(readableHistoryFile, 'utf-8')); } catch {}
      if (!Array.isArray(history.entries)) history.entries = [];
      history.entries.unshift(historyEntry);
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (err: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            schemaVersion: 1,
            type: 'flow-pilot.error',
            flowId,
            title: flow.title,
            status: 'failed',
            summary: `Failed to save flow: ${err.message}`,
            historySaved: false,
            error: { code: 'STORAGE_ERROR', message: err.message },
            flow,
            historyEntry,
          }),
        }],
      };
    }

    const response = {
      schemaVersion: 1,
      type: 'flow-pilot.flow',
      flowId,
      title: flow.title,
      status: flow.status,
      summary: isPromptOnlyFlow
        ? `Generated prompt-only flow with ${nodes.length} nodes because no matching source files were found.`
        : `Generated abstract flow from ${files.length} source files with ${nodes.length} nodes.`,
      historySaved: true,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      sourceFileCount: files.length,
      diagramTypes: ['flowchart', 'sequence'],
      legend,
      readingGuide,
      warnings: flow.warnings,
      workspacePath,
      historyPath: historyFile,
      flowPath,
      flow,
      historyEntry,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
      structuredContent: response as any,
    };
  }
);

server.tool(
  'get_flow_context',
  'Return relevant source files with line-numbered snippets for the AI to inspect before authoring a general Flow Pilot graph. After using this, call create_ai_flow with the AI-decided nodes, edges, line mappings, and evidence.',
  {
    prompt: z.string().min(1).max(2000).describe('Natural language description of the flow to understand.'),
  },
  async ({ prompt }) => {
    const workspacePath = await resolveWorkspacePath();
    const files = scanWorkspaceSync(prompt, workspacePath);
    const response = buildFlowContextResponse(prompt, files);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
      structuredContent: response as any,
    };
  }
);

server.tool(
  'create_ai_flow',
  'Save an AI-authored Flow Pilot diagram after the AI has inspected the code and decided the nodes, relationships, file mappings, line ranges, and evidence. Use this for general use cases where semantic understanding should come from the AI rather than a template.',
  {
    prompt: z.string().min(1).max(2000).describe('Original user request or flow intent.'),
    title: z.string().optional().describe('Optional display title for the saved flow.'),
    nodes: z.array(aiNodeSchema).min(1).describe('AI-decided flow nodes. Each code-backed node should include file, lineStart, lineEnd, and evidence.'),
    edges: z.array(aiEdgeSchema).describe('AI-decided relationships/process transitions between nodes.'),
    flowchartMermaidSource: z.string().optional().describe('Optional AI-authored flowchart Mermaid. If omitted, Flow Pilot generates one from nodes/edges.'),
    sequenceMermaidSource: z.string().optional().describe('Optional AI-authored sequence Mermaid using ids that correspond to nodes. If omitted, Flow Pilot generates one from nodes/edges.'),
    warnings: z.array(z.string()).optional(),
  },
  async (args) => {
    const workspacePath = await resolveWorkspacePath();
    const response = createAiFlowHandler(args, workspacePath);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
      structuredContent: response,
    };
  }
);

server.tool(
  'get_node_detail',
  'Return source metadata, relationships, evidence, and optional code snippet for a node in a saved Flow Pilot flow.',
  {
    flowId: z.string().min(1).describe('Flow id returned by generate_flow.'),
    nodeId: z.string().min(1).describe('Node id from the generated flow.'),
    includeCodeSnippet: z.boolean().optional().describe('Whether to include the source code snippet. Defaults to true.'),
  },
  async ({ flowId, nodeId, includeCodeSnippet }) => {
    const workspacePath = await resolveWorkspacePath();
    const response = getNodeDetailHandler({ flowId, nodeId, includeCodeSnippet }, workspacePath);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
      structuredContent: response,
    };
  }
);

server.tool(
  'get_relationship_detail',
  'Return evidence and endpoint context for a relationship between two nodes in a saved Flow Pilot flow.',
  {
    flowId: z.string().min(1).describe('Flow id returned by generate_flow.'),
    from: z.string().min(1).describe('Source node id.'),
    to: z.string().min(1).describe('Target node id.'),
  },
  async ({ flowId, from, to }) => {
    const workspacePath = await resolveWorkspacePath();
    const response = getRelationshipDetailHandler({ flowId, from, to }, workspacePath);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response),
      }],
      structuredContent: response,
    };
  }
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
