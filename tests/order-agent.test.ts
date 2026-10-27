import { describe, expect, it } from 'vitest';
import { runOrderAgent } from '../src/agent/order-agent.js';
import type { AgentModel, ModelTurn } from '../src/agent/types.js';
import type { CommerceRepository } from '../src/types.js';

const repo: CommerceRepository = {
  getOrder: async id => id === 1042 ? { id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 } : null,
  listOrders: async () => [],
  getCustomer: async () => null,
  listInventory: async () => [],
};
const fake = (...turns: ModelTurn[]): AgentModel => {
  let index = 0;
  return { next: async () => turns[index++] ?? { responseId: 'fallback', calls: [], text: 'Done' } };
};
const call = (id: number) => ({ responseId: 'r1', text: '', calls: [{ callId: 'call_1', name: 'get_order_status', arguments: JSON.stringify({ orderId: id }) }] });

describe('Bounded order agent', () => {
  it('looks up an order then answers', async () => {
    const model = fake(call(1042), { responseId: 'r2', text: 'Order 1042 is shipped.', calls: [] });
    const result = await runOrderAgent('Where is order 1042?', repo, model);
    expect(result.answer).toContain('shipped');
    expect(result.toolCalls).toBe(1);
    expect(result.events.map(event => event.type)).toEqual(['tool_call', 'tool_result', 'final']);
  });
  it('handles an unknown order', async () => {
    const model = fake(call(9999), { responseId: 'r2', text: 'That order was not found.', calls: [] });
    const result = await runOrderAgent('Order 9999?', repo, model);
    expect(result.toolCalls).toBe(1);
  });
  it('denies unauthorized tools', async () => {
    const model = fake({ responseId: 'r1', text: '', calls: [{ callId: 'x', name: 'refund_order', arguments: '{}' }] });
    await expect(runOrderAgent('Refund me', repo, model)).rejects.toThrow('Tool not permitted');
  });
  it('rejects malformed tool parameters', async () => {
    const model = fake({ responseId: 'r1', text: '', calls: [{ callId: 'x', name: 'get_order_status', arguments: '{"orderId":"oops"}' }] });
    await expect(runOrderAgent('My order', repo, model)).rejects.toThrow('Invalid order ID');
  });
  it('enforces a tool call budget', async () => {
    const model = fake({ responseId: 'r1', text: '', calls: [1, 2, 3].map(n => ({ callId: String(n), name: 'get_order_status', arguments: '{"orderId":1042}' })) });
    await expect(runOrderAgent('Find my order', repo, model)).rejects.toThrow('budget exceeded');
  });
  it('rejects empty questions', async () => {
    await expect(runOrderAgent(' ', repo, fake())).rejects.toThrow('Question must be');
  });
});
