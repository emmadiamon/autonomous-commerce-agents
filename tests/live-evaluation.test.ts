import { describe, expect, it } from 'vitest';
import { runLiveEvaluation } from '../src/evaluation/live.js';

function fakeResponses() {
  const seen: Array<{ model: string; tools: Array<{ name: string }>; input: unknown }> = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      model: string; tools: Array<{ name: string }>; input: unknown;
    };
    seen.push(body);
    const tool = body.tools[0].name;
    const continuation = Array.isArray(body.input);
    const responses: Record<string, { args: object; answer: string }> = {
      get_order_status: { args: { orderId: 1042 }, answer: 'Order 1042 was shipped.' },
      get_low_stock: { args: { threshold: 10 }, answer: 'Cotton T-shirt has 8 left.' },
      get_processing_orders: { args: {}, answer: 'Order 1043 is processing.' },
    };
    const fixture = responses[tool];
    const payload = {
      id: 'resp-' + seen.length, usage: { input_tokens: 10, output_tokens: 5 },
      output: continuation
        ? [{ type: 'message', content: [{ type: 'output_text', text: fixture.answer }] }]
        : [{ type: 'function_call', call_id: 'call-' + seen.length, name: tool, arguments: JSON.stringify(fixture.args) }],
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetcher, seen };
}

describe('Opt-in live evaluation with mocked API', () => {
  it('meters response usage and grades all three roles', async () => {
    const { fetcher, seen } = fakeResponses();
    const report = await runLiveEvaluation({
      apiKey: 'fake-for-test', model: 'test-model', fetcher, maxRequests: 9,
      inputPricePerMillion: 1, outputPricePerMillion: 5,
    });
    expect(report).toMatchObject({
      mode: 'live-opt-in', total: 3, passed: 3, failed: 0,
      requestsMade: 6, inputTokens: 60, outputTokens: 30,
      tokenUsageComplete: true, estimatedCostUsd: 0.00021,
    });
    expect(seen).toHaveLength(6);
  });

  it('never issues more requests than the cap', async () => {
    const { fetcher, seen } = fakeResponses();
    const report = await runLiveEvaluation({
      apiKey: 'fake-for-test', model: 'test-model', fetcher, maxRequests: 1,
    });
    expect(seen).toHaveLength(1);
    expect(report.requestsMade).toBe(1);
    expect(report.failed).toBeGreaterThan(0);
    expect(report.estimatedCostUsd).toBeNull();
  });

  it('rejects invalid caps before any requests', async () => {
    const { fetcher, seen } = fakeResponses();
    await expect(runLiveEvaluation({
      apiKey: 'fake-for-test', model: 'test-model', fetcher, maxRequests: 10,
    })).rejects.toThrow('Request cap');
    expect(seen).toHaveLength(0);
  });
});
