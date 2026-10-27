import type { CommerceRepository } from '../types.js';
import type { AgentAnswer, AgentEvent, AgentModel, ToolResult } from './types.js';

const MAX_TOOL_CALLS = 2;
const MAX_TURNS = 4;

export async function runOrderAgent(question: string, repository: CommerceRepository, model: AgentModel): Promise<AgentAnswer> {
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) {
    throw new Error('Question must be 1-1000 characters');
  }
  const events: AgentEvent[] = [];
  let toolCalls = 0;
  let previousResponseId: string | undefined;
  let toolResults: ToolResult[] | undefined;
  const seenCallIds = new Set<string>();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const result = await model.next({ question, previousResponseId, toolResults });
    previousResponseId = result.responseId;
    if (result.calls.length === 0) {
      const answer = result.text.trim();
      if (!answer) throw new Error('Agent returned no answer');
      events.push({ type: 'final', detail: 'Model completed response' });
      return { answer, toolCalls, events };
    }

    if (toolCalls + result.calls.length > MAX_TOOL_CALLS) {
      throw new Error('Agent tool-call budget exceeded');
    }

    toolResults = [];
    for (const call of result.calls) {
      if (seenCallIds.has(call.callId)) throw new Error('Duplicate tool call ID');
      seenCallIds.add(call.callId);
      if (call.name !== 'get_order_status') throw new Error('Tool not permitted');
      let parsed: unknown;
      try { parsed = JSON.parse(call.arguments); } catch { throw new Error('Invalid tool arguments'); }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !('orderId' in parsed)) {
        throw new Error('Invalid tool arguments');
      }
      const idValue = (parsed as { orderId: unknown }).orderId;
      if (typeof idValue !== 'number' || !Number.isSafeInteger(idValue) || idValue <= 0) {
        throw new Error('Invalid order ID');
      }
      // Only read-only order metadata. Never expose a customer's email or private profile to the model.
      const order = await repository.getOrder(idValue);
      const output = JSON.stringify(order ? { id: order.id, status: order.status } : { found: false });
      toolCalls++;
      events.push({ type: 'tool_call', name: call.name, detail: 'Order lookup requested' });
      events.push({ type: 'tool_result', name: call.name, detail: order ? 'Order found' : 'Order not found' });
      toolResults.push({ callId: call.callId, output });
    }
  }
  throw new Error('Agent turn budget exceeded');
}
