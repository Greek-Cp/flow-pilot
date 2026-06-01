import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { createAiFlowHandler } from '../../src/mcp/aiFlowTool';

describe('aiFlowTool', () => {
  it('saves an AI-authored flow with source line mappings', () => {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-pilot-ai-flow-'));

    const response = createAiFlowHandler({
      prompt: 'Map checkout payment flow',
      title: 'Checkout Payment Flow',
      nodes: [
        {
          id: 'checkout_screen',
          label: 'Checkout Screen',
          type: 'ui',
          file: 'src/checkout.tsx',
          lineStart: 10,
          lineEnd: 30,
          reason: 'AI identified this as the flow entry screen.',
        },
        {
          id: 'submit_payment',
          label: 'submitPayment()',
          type: 'process',
          file: 'src/payment.ts',
          lineStart: 4,
          lineEnd: 18,
          reason: 'AI identified this as the payment submission operation.',
        },
        {
          id: 'payment_saved',
          label: 'Payment saved',
          type: 'success',
          file: 'src/payment.ts',
          lineStart: 16,
          lineEnd: 18,
        },
      ],
      edges: [
        {
          from: 'checkout_screen',
          to: 'submit_payment',
          label: 'Submit payment',
          reason: 'The checkout screen calls the payment operation.',
        },
        {
          from: 'submit_payment',
          to: 'payment_saved',
          label: 'Success',
        },
      ],
    }, workspacePath);

    expect(response.type).toBe('flow-pilot.flow');
    if (response.type !== 'flow-pilot.flow') throw new Error('expected flow response');
    expect(response.title).toBe('Checkout Payment Flow');

    const flowPath = path.join(workspacePath, '.flow-pilot', 'flows', `${response.flowId}.json`);
    const saved = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));
    expect(saved.nodes[0]).toMatchObject({
      id: 'checkout_screen',
      file: 'src/checkout.tsx',
      lineStart: 10,
      lineEnd: 30,
    });
    expect(saved.diagrams.map((diagram: any) => diagram.type)).toEqual(['flowchart', 'sequence']);
  });
});
