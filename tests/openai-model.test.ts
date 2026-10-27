import { describe, expect, it } from 'vitest';
import { createOpenAIModel } from '../src/agent/openai-model.js';

describe('OpenAI adapter', () => {
  it('parses function calls and subsequent text from the REST response', async () => {
    const requests: unknown[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      requests.push(JSON.parse(init?.body as string));
      return new Response(JSON.stringify(requests.length === 1
        ? { id: 'r1', output: [{ type: 'function_call', call_id: 'c1', name: 'get_order_status', arguments: '{"orderId":1042}' }] }
        : { id: 'r2', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Order shipped.' }] }] }), { status: 200 });
    };
    const model = createOpenAIModel({ apiKey: 'test-key', fetcher });
    const first = await model.next({ question: 'Where is order 1042?' });
    expect(first.calls).toEqual([{ callId: 'c1', name: 'get_order_status', arguments: '{"orderId":1042}' }]);
    const second = await model.next({ question: 'Where is order 1042?', previousResponseId: first.responseId, toolResults: [{ callId: 'c1', output: '{"id":1042,"status":"SHIPPED"}' }] });
    expect(second.text).toBe('Order shipped.');
    expect((requests[1] as { previous_response_id: string }).previous_response_id).toBe('r1');
  });
});
