/**
 * Flow Pilot — Mermaid Builder
 * Converts nodes/edges into valid Mermaid syntax
 */

import type { Node, Edge } from '../types/flow';

/** Node type → Mermaid shape mapping */
const NODE_SHAPES: Record<string, { open: string; close: string }> = {
  ui:         { open: '[', close: ']' },           // Rectangle
  controller: { open: '[', close: ']' },           // Rectangle
  service:    { open: '(', close: ')' },           // Rounded
  repository: { open: '[(', close: ')]' },         // Cylinder
  model:      { open: '{', close: '}' },           // Rhombus
  api:        { open: '[[', close: ']]' },         // Stadium
  sdk:        { open: '[[', close: ']]' },         // Stadium
  external:   { open: '([', close: '])' },         // Subroutine
  unknown:    { open: '[', close: ']' },           // Rectangle
};

/** Sanitize a label for Mermaid syntax */
function sanitizeLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/[\[\]{}()]/g, (ch) => `\\${ch}`)
    .replace(/\n/g, ' ')
    .substring(0, 60); // Truncate long labels
}

/** Sanitize a node ID for Mermaid syntax */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Build a Mermaid flowchart from nodes and edges */
export function buildMermaidFlowchart(nodes: Node[], edges: Edge[]): string {
  const lines: string[] = ['flowchart TD'];

  // Add nodes
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    const shape = NODE_SHAPES[node.type] || NODE_SHAPES.unknown;
    lines.push(`    ${id}${shape.open}"${label}"${shape.close}`);
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

  // Add participants
  for (const node of nodes) {
    const id = sanitizeId(node.id);
    const label = sanitizeLabel(node.label);
    // Use "actor" for UI nodes, "participant" for others
    const keyword = node.type === 'ui' ? 'actor' : 'participant';
    lines.push(`    ${keyword} ${id} as ${label}`);
  }

  // Add messages (edges)
  for (const edge of edges) {
    const from = sanitizeId(edge.from);
    const to = sanitizeId(edge.to);
    const label = edge.label ? sanitizeLabel(edge.label) : '';
    lines.push(`    ${from}->>${to}: ${label}`);
  }

  return lines.join('\n');
}
