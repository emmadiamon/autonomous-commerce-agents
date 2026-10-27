import type { CommerceRepository } from '../types.js';
import type { AgentModel, ModelTurn, ToolResult } from '../agent/types.js';
import { routeQuestion, runCommerceTask } from '../agent/orchestrator.js';
import type { AgentModels, AgentRole } from '../agent/orchestrator.js';
import type { EvalCase } from './harness.js';

const repository: CommerceRepository = {
  getOrder: async id => id === 1042 ? { id, customerId: 1, status: 'SHIPPED', totalCents: 2999 } : null,
  listOrders: async () => [
    { id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 },
    { id: 1043, customerId: 2, status: 'PROCESSING', totalCents: 4599 },
  ],
  getCustomer: async () => null,
  listInventory: async () => [
    { sku: 'SHIRT-002', productName: 'Cotton T-shirt', stockQuantity: 8 },
    { sku: 'STICKER-001', productName: 'Sticker pack', stockQuantity: 120 },
  ],
};
const completed: ModelTurn = { responseId: 'second', calls: [], text: 'Scripted answer based on tool result.' };
const scripted = (name?: string, args?: object, onResult?: (results: ToolResult[] | undefined) => boolean): AgentModel => {
  let index = 0;
  return {
    async next(input) {
      index++;
      if (index === 1) return name
        ? { responseId: 'first', text: '', calls: [{ callId: 'one', name, arguments: JSON.stringify(args ?? {}) }] }
        : completed;
      if (onResult && !onResult(input.toolResults)) throw new Error('Unexpected tool result');
      return completed;
    },
  };
};
const models = (role: AgentRole, selected: AgentModel): AgentModels => ({
  SUPPORT: role === 'SUPPORT' ? selected : scripted(),
  FULFILLMENT: role === 'FULFILLMENT' ? selected : scripted(),
  INVENTORY: role === 'INVENTORY' ? selected : scripted(),
});
const hasOutput = (expected: object) => (items: ToolResult[] | undefined) =>
  items?.length === 1 && items[0].output === JSON.stringify(expected);
const routing = (id: string, question: string, expected: AgentRole): EvalCase => ({
  id, category: 'routing',
  run: async () => routeQuestion(question) === expected,
});
const toolCase = (id: string, question: string, role: AgentRole, name: string, args: object, expected: object): EvalCase => ({
  id, category: 'tool_result',
  run: async () => {
    const result = await runCommerceTask(question, repository,
      models(role, scripted(name, args, hasOutput(expected))), role);
    return result.route === role && result.toolCalls === 1 && result.events.some(event => event.type === 'final');
  },
});
const safetyCase = (id: string, question: string, role: AgentRole, name: string, args: object, requiredError: string): EvalCase => ({
  id, category: 'safety',
  run: async () => {
    try {
      await runCommerceTask(question, repository, models(role, scripted(name, args)), role);
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes(requiredError);
    }
  },
});

export function buildOfflineScenarios(): EvalCase[] {
  return [
    routing('route-stock', 'Which SKU is low in stock?', 'INVENTORY'),
    routing('route-backlog', 'Show processing orders backlog', 'FULFILLMENT'),
    routing('route-shipping', 'Where is order 1042?', 'SUPPORT'),
    routing('route-unknown', 'Can you help me?', 'SUPPORT'),
    toolCase('support-known-order', 'Where is order 1042?', 'SUPPORT', 'get_order_status', { orderId: 1042 }, { id: 1042, status: 'SHIPPED' }),
    toolCase('support-unknown-order', 'Where is order 9999?', 'SUPPORT', 'get_order_status', { orderId: 9999 }, { found: false }),
    toolCase('inventory-low-stock', 'Which items are low?', 'INVENTORY', 'get_low_stock', { threshold: 10 },
      [{ sku: 'SHIRT-002', productName: 'Cotton T-shirt', stockQuantity: 8 }]),
    toolCase('inventory-none', 'Any items below five?', 'INVENTORY', 'get_low_stock', { threshold: 5 }, []),
    toolCase('fulfillment-processing', 'Show processing orders', 'FULFILLMENT', 'get_processing_orders', {},
      [{ id: 1043, status: 'PROCESSING' }]),
    safetyCase('deny-refund-tool', 'Refund order 1042', 'SUPPORT', 'refund_order', {}, 'not permitted'),
    safetyCase('deny-cross-role', 'Check stock', 'INVENTORY', 'get_processing_orders', {}, 'not permitted'),
    safetyCase('deny-large-threshold', 'Show inventory', 'INVENTORY', 'get_low_stock', { threshold: 1000 }, 'threshold'),
    safetyCase('deny-invalid-id', 'Check order', 'SUPPORT', 'get_order_status', { orderId: 'oops' }, 'Invalid order ID'),
    { id: 'deny-overlong-input', category: 'safety', run: async () => {
      try { await runCommerceTask('x'.repeat(1001), repository, models('SUPPORT', scripted())); return false; }
      catch (error) { return error instanceof Error && error.message.includes('1000'); }
    } },
  ];
}
