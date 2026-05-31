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

// Resolve workspace path from args or cwd
const workspacePath = process.argv[2] || process.cwd();

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

function scanWorkspaceSync(prompt: string, wsPath: string): ScannedFile[] {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) return [];

  const scanned: ScannedFile[] = [];
  const seen = new Set<string>();

  // Walk directories looking for files matching keywords
  const walk = (dir: string, depth: number) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          const matches = keywords.filter(kw => lower.includes(kw));
          if (matches.length > 0 && !seen.has(full)) {
            seen.add(full);
            try {
              const stat = fs.statSync(full);
              if (stat.size > 50_000) continue; // skip large files
              const content = fs.readFileSync(full, 'utf-8').substring(0, 20_000);
              scanned.push({
                path: path.relative(wsPath, full),
                content,
                reason: `Filename matches: ${matches.join(', ')}`,
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
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(full, depth + 1);
        } else if (entry.isFile() && !seen.has(full)) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!['.ts','.js','.tsx','.jsx','.py','.dart','.java','.kt','.swift','.go','.rs','.cs','.rb','.php'].includes(ext)) continue;
          try {
            const stat = fs.statSync(full);
            if (stat.size > 50_000) continue;
            const content = fs.readFileSync(full, 'utf-8');
            const contentLower = content.toLowerCase();
            const matches = keywords.filter(kw => contentLower.includes(kw));
            if (matches.length > 0) {
              seen.add(full);
              scanned.push({
                path: path.relative(wsPath, full),
                content: content.substring(0, 20_000),
                reason: `Contains keywords: ${matches.join(', ')}`,
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  };

  searchDir(wsPath, 0);
  return scanned.slice(0, 30);
}

// ── Inline flow/mermaid builders ──

import * as crypto from 'crypto';

function guessType(fp: string): string {
  const l = fp.toLowerCase();
  if (l.includes('screen') || l.includes('page') || l.includes('view') || l.includes('widget')) return 'ui';
  if (l.includes('controller')) return 'controller';
  if (l.includes('service')) return 'service';
  if (l.includes('repository') || l.includes('repo')) return 'repository';
  if (l.includes('model') || l.includes('entity')) return 'model';
  if (l.includes('api') || l.includes('endpoint') || l.includes('route')) return 'api';
  if (l.includes('sdk') || l.includes('client')) return 'sdk';
  return 'unknown';
}

function sanitizeId(id: string): string { return id.replace(/[^a-zA-Z0-9_]/g, '_'); }
function sanitizeLabel(l: string): string { return l.replace(/"/g, "'").replace(/[\[\]{}()]/g, c => `\\${c}`).replace(/\n/g, ' ').substring(0, 60); }

const SHAPES: Record<string, { o: string; c: string }> = {
  ui: { o: '[', c: ']' }, controller: { o: '[', c: ']' },
  service: { o: '(', c: ')' }, repository: { o: '[(', c: ')]' },
  model: { o: '{', c: '}' }, api: { o: '[[', c: ']]' },
  sdk: { o: '[[', c: ']]' }, external: { o: '([', c: '])' },
  unknown: { o: '[', c: ']' },
};

function buildMermaidFlowchart(nodes: any[], edges: any[]): string {
  const lines = ['flowchart TD'];
  for (const n of nodes) {
    const s = SHAPES[n.type] || SHAPES.unknown;
    lines.push(`    ${sanitizeId(n.id)}${s.o}"${sanitizeLabel(n.label)}"${s.c}`);
  }
  for (const e of edges) {
    if (e.label) lines.push(`    ${sanitizeId(e.from)} -->|"${sanitizeLabel(e.label)}"| ${sanitizeId(e.to)}`);
    else lines.push(`    ${sanitizeId(e.from)} --> ${sanitizeId(e.to)}`);
  }
  return lines.join('\n');
}

function buildMermaidSequence(nodes: any[], edges: any[]): string {
  const lines = ['sequenceDiagram'];
  for (const n of nodes) {
    const kw = n.type === 'ui' ? 'actor' : 'participant';
    lines.push(`    ${kw} ${sanitizeId(n.id)} as ${sanitizeLabel(n.label)}`);
  }
  for (const e of edges) {
    lines.push(`    ${sanitizeId(e.from)}>>${sanitizeId(e.to)}: ${e.label || ''}`);
  }
  return lines.join('\n');
}

// ── Create MCP Server ──

const server = new McpServer({ name: 'flow-pilot', version: '0.1.0' });

server.tool(
  'generate_flow',
  'Analyze the current workspace codebase and generate an interactive code flow diagram from a natural language prompt.',
  { prompt: z.string().min(1).max(2000).describe('Natural language description of the code flow to visualize.') },
  async ({ prompt }) => {
    // 1. Validate
    if (!prompt.trim()) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'failed', error: { code: 'EMPTY_PROMPT', message: 'Prompt is empty' } }) }] };
    }

    // 2. Scan
    const files = scanWorkspaceSync(prompt, workspacePath);
    if (files.length === 0) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'failed', error: { code: 'NO_RELEVANT_FILES', message: 'No relevant files found' } }) }] };
    }

    // 3. Build nodes from files
    const nodes = files.slice(0, 50).map((f, i) => ({
      id: `file_${i}`,
      label: f.path.split('/').pop() || f.path,
      type: guessType(f.path),
      file: f.path,
      lineStart: 1,
      lineEnd: Math.min(50, f.content.split('\n').length),
      description: f.reason,
    }));

    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) edges.push({ from: nodes[i].id, to: nodes[i + 1].id });

    // 4. Build Mermaid
    const fcMermaid = buildMermaidFlowchart(nodes, edges);
    const sqMermaid = buildMermaidSequence(nodes, edges);

    // 5. Build flow object
    const flowId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = prompt.replace(/^(show|find|generate|create|display|trace|visualize)\s+/i, '').replace(/\s+(flow|diagram)$/i, '').trim() || 'Generated Flow';

    const flow = {
      id: flowId,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description: `Code flow generated from: "${prompt.substring(0, 100)}"`,
      requestPrompt: prompt,
      status: 'success',
      createdAt: now,
      updatedAt: now,
      diagramTypes: ['flowchart', 'sequence'],
      nodes, edges,
      sourceFiles: files.map(f => ({ path: f.path, reason: f.reason })),
      diagrams: [
        { type: 'flowchart', mermaidSource: fcMermaid },
        { type: 'sequence', mermaidSource: sqMermaid },
      ],
    };

    // 6. Save to disk
    const pilotDir = path.join(workspacePath, '.vscode', 'flow-pilot');
    const flowsDir = path.join(pilotDir, 'flows');
    const historyFile = path.join(pilotDir, 'history.json');

    try {
      if (!fs.existsSync(flowsDir)) fs.mkdirSync(flowsDir, { recursive: true });
      fs.writeFileSync(path.join(flowsDir, `${flowId}.json`), JSON.stringify(flow, null, 2));

      let history = { version: 1, entries: [] as any[] };
      try { history = JSON.parse(fs.readFileSync(historyFile, 'utf-8')); } catch {}
      history.entries.unshift({
        flowId, title: flow.title, description: flow.description,
        createdAt: now, updatedAt: now, status: 'success',
        diagramTypes: ['flowchart', 'sequence'],
        nodeCount: nodes.length, edgeCount: edges.length, sourceFileCount: files.length,
      });
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (err: any) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'failed', error: { code: 'STORAGE_ERROR', message: err.message } }) }] };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          flowId, title: flow.title, status: 'success',
          summary: `Generated flow from ${files.length} files with ${nodes.length} nodes.`,
          historySaved: true, nodeCount: nodes.length, edgeCount: edges.length,
          sourceFileCount: files.length, diagramTypes: ['flowchart', 'sequence'],
        }),
      }],
    };
  }
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
