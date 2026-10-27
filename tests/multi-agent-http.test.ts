import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { CommerceRepository } from '../src/types.js';
import type { AgentModels } from '../src/agent/orchestrator.js';

const repository: CommerceRepository = {
  getOrder: async () => null,
  listOrders: async () => [{ id: 1043, customerId: 2, status: 'PROCESSING', totalCents: 4599 }],
  getCustomer: async () => null,
  listInventory: async () => [{ sku: 'SHIRT-002', productName: 'Cotton shirt', stockQuantity: 8 }],
};
const model = (tool: string, args: string) => ({
  async next(input: { previousResponseId?: string; toolResults?: Array<{ output: string }> }) {
    if (!input.previousResponseId) return { responseId: 'first', calls: [{ callId: 'c1', name: tool, arguments: args }], text: '' };
    expect(input.toolResults).toHaveLength(1);
    return { responseId: 'second', calls: [], text: 'Here is the summary.' };
  },
});
const models: AgentModels = {
  SUPPORT: model('get_order_status', '{"orderId":1042}'),
  FULFILLMENT: model('get_processing_orders', '{}'),
  INVENTORY: model('get_low_stock', '{"threshold":10}'),
};

describe('Multi-agent GraphQL API', () => {
  it('routes an inventory question automatically', async () => {
    const app = createApp(repository, models.SUPPORT, models);
    const response = await app.fetch(new Request('http://localhost/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { askCommerceAgent(question: "Show low stock products") { route answer toolCalls } }' }),
    }));
    const result = await response.json() as { data?: { askCommerceAgent?: { route: string; toolCalls: number } }; errors?: unknown[] };
    expect(result.errors).toBeUndefined();
    expect(result.data?.askCommerceAgent).toMatchObject({ route: 'INVENTORY', toolCalls: 1 });
  });
  it('honors explicit fulfillment routing', async () => {
    const app = createApp(repository, models.SUPPORT, models);
    const response = await app.fetch(new Request('http://localhost/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { askCommerceAgent(question: "Show active work", route: FULFILLMENT) { route toolCalls } }' }),
    }));
    const result = await response.json() as { data?: { askCommerceAgent?: { route: string; toolCalls: number } }; errors?: unknown[] };
    expect(result.errors).toBeUndefined();
    expect(result.data?.askCommerceAgent).toMatchObject({ route: 'FULFILLMENT', toolCalls: 1 });
  });
});
