/**
 * Flow Pilot — History Types
 * Based on data-model.md HistoryEntry definition
 */

import type { FlowStatus, DiagramType } from './flow';

/** Lightweight index record for fast history listing */
export interface HistoryEntry {
  /** References Flow.id */
  flowId: string;
  /** Copied from Flow.title */
  title: string;
  /** Copied from Flow.description */
  description: string;
  /** Timestamp of creation (ISO 8601) */
  createdAt: string;
  /** Timestamp of last modification (ISO 8601) */
  updatedAt: string;
  /** Generation status */
  status: FlowStatus;
  /** Available diagram types */
  diagramTypes: DiagramType[];
  /** Number of nodes in the flow */
  nodeCount: number;
  /** Number of edges in the flow */
  edgeCount: number;
  /** Number of source files analyzed */
  sourceFileCount: number;
}

/** The history index file schema */
export interface HistoryIndex {
  /** Schema version for migration support */
  version: number;
  /** Array of history entries */
  entries: HistoryEntry[];
}
