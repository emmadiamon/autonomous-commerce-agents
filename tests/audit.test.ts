import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createMemoryAuditStore } from '../src/audit.js';
import type { CommerceRepository } from '../src/types.js';
import type { AgentModel } from '../src/agent/types.js';
import type { AgentModels } from '../src/agent/orchestrator.js';

const repository: CommerceRepository = {
  getOrder: async () => null, getCustomer: async () => null,
  listOrders: async () => [], listInventory: async () => [],
};
const model: AgentModel = {
  next: async () => ({ responseId: 'one', calls: [], text: 'No changes were made.' }),
};
const models: AgentModels = { SUPPORT: model, INVENTORY: model, FULFILLMENT: model };

describe('Agent audit metadata', () => {
  it('records outcome without persisting prompts or replies', async () => {
    const audit = createMemoryAuditStore();
    const app = createApp(repository, model, models, undefined, audit);
    const result = await app.fetch(new Request('http://localhost/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { askCommerceAgent(question:"What is happening?",route:INVENTORY) { route answer toolCalls } }' }),
    }));
    const json = await result.json() as { data: { askCommerceAgent: { route: string } } };
    expect(json.data.askCommerceAgent.route).toBe('INVENTORY');
    const events = await audit.list();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: 'AGENT', action: 'AGENT_RUN', actor: 'demo-admin',
      subject: 'INVENTORY', outcome: 'SUCCESS', toolCalls: 0,
    });
    expect(JSON.stringify(events)).not.toContain('What is happening?');
    expect(JSON.stringify(events)).not.toContain('No changes were made.');
  });
});
