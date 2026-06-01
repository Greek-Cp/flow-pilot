import { describe, expect, it } from 'vitest';
import { buildPromptDirectedFlow } from '../../src/mcp/promptFlowBuilder';

describe('promptFlowBuilder', () => {
  it('builds a branching flow for a non-auth use case from source clues', () => {
    const flow = buildPromptDirectedFlow(
      [
        'Generate checkout payment flow from checkout screen until payment is saved.',
        'Include validation failure and successful charge result.',
      ].join('\n'),
      [
        {
          path: 'src/features/checkout/CheckoutScreen.tsx',
          reason: 'fixture',
          content: 'export function CheckoutScreen() {\n  return submitPayment({ total: 100 });\n}',
        },
        {
          path: 'src/api/paymentController.ts',
          reason: 'fixture',
          content: 'export async function submitPayment(req) {\n  if (!req.user) throw new UnauthorizedError();\n  return createPayment(req.body);\n}',
        },
        {
          path: 'src/services/paymentService.ts',
          reason: 'fixture',
          content: 'export async function createPayment(input) {\n  if (input.total <= 0) return Left(new ValidationFailure());\n  const charge = await stripeCharge(input);\n  await savePayment(charge);\n  return Right(charge);\n}',
        },
        {
          path: 'src/data/paymentRepository.ts',
          reason: 'fixture',
          content: 'export class PaymentRepository {\n  async savePayment(payment) { return database.insert(payment); }\n}',
        },
        {
          path: 'src/data/stripeDatasource.ts',
          reason: 'fixture',
          content: 'export async function stripeCharge(input) {\n  return stripe.client.charge(input);\n}',
        },
      ]
    );

    expect(flow).not.toBeNull();
    expect(flow?.nodes.some((node) => node.type === 'decision')).toBe(true);
    expect(flow?.nodes.some((node) => node.type === 'error')).toBe(true);
    expect(flow?.nodes.some((node) => node.type === 'success')).toBe(true);
    expect(flow?.nodes.some((node) => node.label === 'Checkout Screen')).toBe(true);
    expect(flow?.nodes.some((node) => node.symbolName === 'createPayment' && node.type === 'process')).toBe(true);
    expect(flow?.nodes.some((node) => node.symbolName === 'stripeCharge')).toBe(true);
    expect(flow?.edges.some((edge) => edge.label?.includes('createPayment'))).toBe(true);
    expect(flow?.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'file_0', to: 'file_1' }),
      ])
    );
  });
});
