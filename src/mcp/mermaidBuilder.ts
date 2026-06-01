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

/** Icon per node type so readers can distinguish screens/APIs/services/data stores. */
function nodeEmoji(type: string): string {
  switch (type) {
    case 'external': return '👤';
    case 'ui': return '🖥️';
    case 'api': return '🔌';
    case 'controller': return '🎮';
    case 'service': return '⚙️';
    case 'sdk': return '🧩';
    case 'repository':
    case 'datasource': return '🗄️';
    case 'model': return '📦';
    case 'function':
    case 'method': return '🔧';
    case 'class': return '🏛️';
    default: return '📄';
  }
}

/** Type-specific Mermaid shape so each node category is visually distinct. */
function flowchartNodeDecl(id: string, type: string, label: string): string {
  const text = `${nodeEmoji(type)} ${label}`.trim();
  switch (type) {
    case 'external': return `${id}(["${text}"])`;      // stadium — user/actor
    case 'ui': return `${id}[/"${text}"/]`;             // parallelogram — screen/page
    case 'api':
    case 'controller': return `${id}{{"${text}"}}`;     // hexagon — API/endpoint
    case 'service':
    case 'sdk': return `${id}[["${text}"]]`;            // subroutine — service/logic
    case 'repository':
    case 'datasource': return `${id}[("${text}")]`;     // cylinder — data store
    case 'model': return `${id}("${text}")`;            // rounded — model/data
    default: return `${id}["${text}"]`;                 // rectangle — code/file
  }
}

/** Build a Mermaid flowchart from nodes and edges */
export function buildMermaidFlowchart(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = ['flowchart TD'];

  // Add nodes with a type-specific shape + icon
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

  return lines.join('\n');
}

/** Build a Mermaid sequence diagram from nodes and edges */
export function buildMermaidSequence(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = ['sequenceDiagram'];

  // Add participants with a type icon (stick-figure actor only for external users)
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    const keyword = node.type === 'external' ? 'actor' : 'participant';
    lines.push(`    ${keyword} ${id} as ${nodeEmoji(node.type)} ${label}`);
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
