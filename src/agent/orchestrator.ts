import type { CommerceRepository } from '../types.js';
import type { AgentAnswer, AgentEvent, AgentModel, ToolResult } from './types.js';
import { runOrderAgent } from './order-agent.js';

export type AgentRole = 'SUPPORT' | 'FULFILLMENT' | 'INVENTORY';
export type MultiAgentAnswer = AgentAnswer & { route: AgentRole };
export type AgentModels = Record<AgentRole, AgentModel>;
const MAX_TOOL_CALLS = 2;

// Predictable routing makes this demo auditable. Explicit role overrides are validated by GraphQL.
export function routeQuestion(question: string): AgentRole {
  const value = question.toLowerCase();
  if (/inventory|stock|replenish|low supply|out of stock|sku/.test(value)) return 'INVENTORY';
  if (/fulfill|processing orders|stuck orders|backlog|unshipped|pending orders/.test(value)) return 'FULFILLMENT';
  return 'SUPPORT';
}

export async function runCommerceTask(
  question: string, repository: CommerceRepository, models: AgentModels, requestedRole?: AgentRole,
): Promise<MultiAgentAnswer> {
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) {
    throw new Error('Question must be 1-1000 characters');
  }
  const route = requestedRole ?? routeQuestion(question);
  if (!['SUPPORT', 'FULFILLMENT', 'INVENTORY'].includes(route)) throw new Error('Unsupported agent role');
  if (route === 'SUPPORT') return { route, ...await runOrderAgent(question, repository, models.SUPPORT) };

  const events: AgentEvent[] = [];
  const model = models[route];
  let previousResponseId: string | undefined;
  let toolResults: ToolResult[] | undefined;
  let toolCalls = 0;
  const callIds = new Set<string>();

  for (let turn = 0; turn < 4; turn++) {
    const response = await model.next({ question, previousResponseId, toolResults });
    previousResponseId = response.responseId;
    if (!response.calls.length) {
      if (!response.text.trim()) throw new Error('Agent returned no answer');
      events.push({ type: 'final', detail: 'Model completed response' });
      return { route, answer: response.text.trim(), toolCalls, events };
    }
    if (toolCalls + response.calls.length > MAX_TOOL_CALLS) throw new Error('Agent tool-call budget exceeded');
    toolResults = [];

    for (const call of response.calls) {
      if (!call.callId || callIds.has(call.callId)) throw new Error('Duplicate or missing call ID');
      callIds.add(call.callId);
      const expected = route === 'INVENTORY' ? 'get_low_stock' : 'get_processing_orders';
      if (call.name !== expected) throw new Error('Tool not permitted for agent role');
      let args: unknown;
      try { args = JSON.parse(call.arguments); } catch { throw new Error('Invalid tool arguments'); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid tool arguments');

      let output: string;
      if (route === 'INVENTORY') {
        const threshold = (args as { threshold?: unknown }).threshold;
        if (typeof threshold !== 'number' || !Number.isSafeInteger(threshold) || threshold < 1 || threshold > 100) {
          throw new Error('Inventory threshold must be an integer from 1 to 100');
        }
        const items = await repository.listInventory();
        output = JSON.stringify(items.filter(item => item.stockQuantity <= threshold).map(item => ({
          sku: item.sku, productName: item.productName, stockQuantity: item.stockQuantity,
        })));
      } else {
        const orders = await repository.listOrders();
        // Processing status alone does not prove a delay. Never claim a shipment is late without timing data.
        output = JSON.stringify(orders.filter(order => order.status === 'PROCESSING').map(order => ({
          id: order.id, status: order.status,
        })));
      }
      toolCalls++;
      events.push({ type: 'tool_call', name: expected, detail: 'Read-only query requested' });
      events.push({ type: 'tool_result', name: expected, detail: 'Read-only query completed' });
      toolResults.push({ callId: call.callId, output });
    }
  }
  throw new Error('Agent turn budget exceeded');
}
