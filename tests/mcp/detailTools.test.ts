import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveFlow } from '../../src/storage/flowStorage';
import { getNodeDetailHandler, getRelationshipDetailHandler } from '../../src/mcp/detailTools';
import type { Flow } from '../../src/types/flow';

const FLOW_ID = '11111111-1111-4111-8111-111111111111';

let workspacePath: string;

beforeEach(() => {
  workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-pilot-test-'));
  fs.mkdirSync(path.join(workspacePath, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(workspacePath, 'src', 'example.ts'),
    [
      'export function runFlow() {',
      '  return "ok";',
      '}',
      '',
    ].join('\n')
  );
  saveFlow(workspacePath, createFlow());
});

afterEach(() => {
  fs.rmSync(workspacePath, { recursive: true, force: true });
});

describe('detailTools', () => {
  it('returns node details with relationships, evidence, and code snippet', () => {
    const result = getNodeDetailHandler({
      flowId: FLOW_ID,
      nodeId: 'run_flow',
    }, workspacePath);

    expect(result.type).toBe('flow-pilot.nodeDetail');
    if (result.type !== 'flow-pilot.nodeDetail') return;

    expect(result.node.symbolName).toBe('runFlow');
    expect(result.outgoing).toHaveLength(1);
    expect(result.evidence[0].file).toBe('src/example.ts');
    expect(result.codeSnippet).toContain('export function runFlow');
  });

  it('returns relationship details for connected nodes', () => {
    const result = getRelationshipDetailHandler({
      flowId: FLOW_ID,
      from: 'run_flow',
      to: 'api',
    }, workspacePath);

    expect(result.type).toBe('flow-pilot.relationshipDetail');
    if (result.type !== 'flow-pilot.relationshipDetail') return;

    expect(result.relationship.reason).toContain('runFlow');
    expect(result.fromNode?.id).toBe('run_flow');
    expect(result.toNode?.id).toBe('api');
  });

  it('returns a stable error for a missing node', () => {
    const result = getNodeDetailHandler({
      flowId: FLOW_ID,
      nodeId: 'missing',
    }, workspacePath);

    expect(result.type).toBe('flow-pilot.error');
    if (result.type !== 'flow-pilot.error') return;

    expect(result.error.code).toBe('NODE_NOT_FOUND');
  });
});

function createFlow(): Flow {
  const now = '2026-06-01T00:00:00.000Z';
  return {
    id: FLOW_ID,
    title: 'Test Flow',
    description: 'Test flow for detail tools',
    requestPrompt: 'show test flow',
    status: 'success',
    createdAt: now,
    updatedAt: now,
    diagramTypes: ['flowchart'],
    nodes: [
      {
        id: 'run_flow',
        label: 'runFlow',
        type: 'function',
        file: 'src/example.ts',
        lineStart: 1,
        lineEnd: 3,
        symbolName: 'runFlow',
        description: 'Runs the test flow',
        reason: 'Scanner matched example flow.',
        confidence: 0.9,
        evidence: [
          {
            kind: 'symbol',
            file: 'src/example.ts',
            lineStart: 1,
            lineEnd: 3,
            symbolName: 'runFlow',
            reason: 'Detected exported function.',
          },
        ],
      },
      {
        id: 'api',
        label: 'API',
        type: 'api',
        file: null,
        lineStart: null,
        lineEnd: null,
        description: 'Target API',
      },
    ],
    edges: [
      {
        from: 'run_flow',
        to: 'api',
        label: 'calls',
        reason: 'runFlow calls API.',
        confidence: 0.7,
        evidence: [
          {
            kind: 'relationship',
            reason: 'Relationship provided by test fixture.',
          },
        ],
      },
    ],
    sourceFiles: [
      {
        path: 'src/example.ts',
        reason: 'Test fixture',
      },
    ],
    diagrams: [
      {
        type: 'flowchart',
        mermaidSource: 'flowchart TD\n  run_flow --> api',
      },
    ],
  };
}
