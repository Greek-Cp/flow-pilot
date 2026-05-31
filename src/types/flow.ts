/**
 * Flow Pilot — Core Flow Types
 * Based on data-model.md entity definitions
 */

/** Allowed node type categories */
export type NodeType =
  | 'ui'
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'api'
  | 'sdk'
  | 'external'
  | 'unknown';

/** Flow generation status */
export type FlowStatus = 'success' | 'failed' | 'partial';

/** Diagram type */
export type DiagramType = 'flowchart' | 'sequence';

/** Represents a code element in the flow */
export interface Node {
  /** Unique within the flow, used for edge references and SVG data-id */
  id: string;
  /** Display name shown in diagram and inspector */
  label: string;
  /** Category of the code element */
  type: NodeType;
  /** Relative path to source file (null if no file mapping) */
  file: string | null;
  /** Starting line number in source file, 1-based (null if no file mapping) */
  lineStart: number | null;
  /** Ending line number in source file, 1-based (null if no file mapping) */
  lineEnd: number | null;
  /** Brief description of what this code element does */
  description?: string;
}

/** Represents a directional relationship between two nodes */
export interface Edge {
  /** ID of the source node */
  from: string;
  /** ID of the target node */
  to: string;
  /** Description of the relationship */
  label?: string;
}

/** A file that was analyzed during flow generation */
export interface SourceFile {
  /** Relative path from workspace root */
  path: string;
  /** Why this file was included */
  reason: string;
}

/** Mermaid diagram source for a specific diagram type */
export interface Diagram {
  /** Diagram type */
  type: DiagramType;
  /** Valid Mermaid syntax string */
  mermaidSource: string;
}

/** Represents a generated code flow visualization */
export interface Flow {
  /** Unique identifier (UUID) */
  id: string;
  /** Human-readable title */
  title: string;
  /** Brief summary of what the flow represents */
  description: string;
  /** Original natural language prompt from the user */
  requestPrompt: string;
  /** Generation status */
  status: FlowStatus;
  /** Timestamp of creation (ISO 8601) */
  createdAt: string;
  /** Timestamp of last modification (ISO 8601) */
  updatedAt: string;
  /** Available diagram types */
  diagramTypes: DiagramType[];
  /** Array of flow nodes (max 50) */
  nodes: Node[];
  /** Array of flow edges */
  edges: Edge[];
  /** Files analyzed during generation */
  sourceFiles: SourceFile[];
  /** Mermaid source for each diagram type */
  diagrams: Diagram[];
  /** Warnings from partial generation */
  warnings?: string[];
}
