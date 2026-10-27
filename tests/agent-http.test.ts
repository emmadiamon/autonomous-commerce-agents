import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { CommerceRepository } from '../src/types.js';
import type { AgentModel } from '../src/agent/types.js';

const repository: CommerceRepository = {
  getOrder: async id => id === 1042 ? { id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 } : null,
  listOrders: async () => [],
  getCustomer: async () => null,
  listInventory: async () => [],
};
let requests = 0;
const model: AgentModel = {
  async next(input) {
    requests++;
    if (!input.previousResponseId) return {
      responseId: 'first', text: '',
      calls: [{ callId: 'tool_1', name: 'get_order_status', arguments: '{"orderId":1042}' }],
    };
    expect(input.toolResults?.[0]?.output).toBe('{"id":1042,"status":"SHIPPED"}');
    return { responseId: 'second', text: 'Order 1042 has shipped.', calls: [] };
  },
};
describe('GraphQL agent integration', () => {
  it('executes the read-only tool through the GraphQL mutation', async () => {
    requests = 0;
    const app = createApp(repository, model);
    const res = await app.fetch(new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { askOrderAgent(question: "Where is 1042?") { answer toolCalls events { type } } }' }),
    }));
    const payload = await res.json() as { data?: { askOrderAgent: { answer: string; toolCalls: number } }; errors?: unknown[] };
    expect(payload.errors).toBeUndefined();
    expect(payload.data?.askOrderAgent).toMatchObject({ answer: 'Order 1042 has shipped.', toolCalls: 1 });
    expect(requests).toBe(2);
  });
});
