import { describe, expect, it } from 'vitest';
import { routeQuestion, runCommerceTask } from '../src/agent/orchestrator.js';
import type { AgentModel, ModelTurn } from '../src/agent/types.js';
import type { CommerceRepository } from '../src/types.js';

const repository: CommerceRepository = {
  getOrder: async id => id === 1042 ? { id, customerId: 1, status: 'SHIPPED', totalCents: 2999 } : null,
  listOrders: async () => [
    { id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 },
    { id: 1043, customerId: 2, status: 'PROCESSING', totalCents: 4599 },
  ],
  getCustomer: async () => null,
  listInventory: async () => [{ sku: 'SHIRT-002', productName: 'Cotton shirt', stockQuantity: 8 }],
};
const model = (...turns: ModelTurn[]): AgentModel => {
  let index = 0;
  return { next: async () => turns[index++] ?? { responseId: 'last', calls: [], text: 'Finished' } };
};
const call = (name: string, args: object): ModelTurn => ({ responseId: 'first', calls: [{ callId: 'one', name, arguments: JSON.stringify(args) }], text: '' });
const end: ModelTurn = { responseId: 'second', calls: [], text: 'Summary based on tool results.' };
const makeModels = (special: AgentModel) => ({ SUPPORT: model(end), FULFILLMENT: special, INVENTORY: special });

describe('Multi-agent orchestrator', () => {
  it('routes based on task domain', () => {
    expect(routeQuestion('Which SKU is low stock?')).toBe('INVENTORY');
    expect(routeQuestion('Show processing orders backlog')).toBe('FULFILLMENT');
    expect(routeQuestion('Where is order 1042?')).toBe('SUPPORT');
  });
  it('runs inventory tool with bounded threshold', async () => {
    const agent = model(call('get_low_stock', { threshold: 10 }), end);
    const result = await runCommerceTask('Show low stock', repository, makeModels(agent));
    expect(result).toMatchObject({ route: 'INVENTORY', toolCalls: 1, answer: end.text });
  });
  it('runs fulfillment query', async () => {
    const agent = model(call('get_processing_orders', {}), end);
    const result = await runCommerceTask('Show processing orders backlog', repository, makeModels(agent));
    expect(result.route).toBe('FULFILLMENT');
    expect(result.toolCalls).toBe(1);
  });
  it('blocks cross-role tool access', async () => {
    const agent = model(call('get_processing_orders', {}));
    await expect(runCommerceTask('Low stock', repository, makeModels(agent))).rejects.toThrow('not permitted');
  });
  it('blocks oversized inventory threshold', async () => {
    const agent = model(call('get_low_stock', { threshold: 100000 }));
    await expect(runCommerceTask('Low stock', repository, makeModels(agent))).rejects.toThrow('threshold');
  });
  it('supports explicit role override', async () => {
    const result = await runCommerceTask('Check our stock', repository, makeModels(model(end)), 'FULFILLMENT');
    expect(result.route).toBe('FULFILLMENT');
  });
  it('rejects invalid questions', async () => {
    await expect(runCommerceTask('', repository, makeModels(model(end)))).rejects.toThrow('Question must');
  });
});
