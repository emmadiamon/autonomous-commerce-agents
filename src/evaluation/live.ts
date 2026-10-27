import { createOpenAIModel } from '../agent/openai-model.js';
import { runCommerceTask, type AgentModels, type AgentRole } from '../agent/orchestrator.js';
import type { CommerceRepository } from '../types.js';

export type LiveCaseResult = {
  id: string; route: AgentRole; passed: boolean; latencyMs: number;
  toolCalls: number; error?: string;
};
export type LiveReport = {
  mode: 'live-opt-in'; model: string; generatedAt: string; requestCap: number;
  requestsMade: number; inputTokens: number; outputTokens: number;
  tokenUsageComplete: boolean; estimatedCostUsd: number | null;
  passed: number; failed: number; total: number;
  latency: { averageMs: number; p95Ms: number };
  results: LiveCaseResult[];
};

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

const cases: Array<{ id: string; role: AgentRole; question: string; expected: RegExp }> = [
  { id: 'support-order-1042', role: 'SUPPORT', question: 'What is the shipping status of fictional order 1042?', expected: /shipped/i },
  { id: 'inventory-low-stock', role: 'INVENTORY', question: 'Which fictional items have stock at or below 10?', expected: /cotton t-shirt|shirt-002/i },
  { id: 'fulfillment-processing', role: 'FULFILLMENT', question: 'Which fictional orders are currently processing? Do not assume delays.', expected: /1043/ },
];

export async function runLiveEvaluation(options: {
  apiKey: string; model: string; maxRequests: number;
  inputPricePerMillion?: number; outputPricePerMillion?: number;
  fetcher?: typeof fetch;
}): Promise<LiveReport> {
  if (!options.apiKey) throw new Error('OPENAI_API_KEY is required');
  if (!options.model) throw new Error('Model is required');
  if (!Number.isSafeInteger(options.maxRequests) || options.maxRequests < 1 || options.maxRequests > 9) {
    throw new Error('Request cap must be an integer from 1 to 9');
  }
  for (const rate of [options.inputPricePerMillion, options.outputPricePerMillion]) {
    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0)) throw new Error('Invalid pricing rate');
  }

  let requestsMade = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let tokenUsageComplete = true;
  const transport = options.fetcher ?? fetch;
  const meteredFetch: typeof fetch = async (input, init) => {
    if (requestsMade >= options.maxRequests) throw new Error('Live evaluation request cap reached');
    requestsMade += 1; // Count attempted calls, even if HTTP fails.
    const response = await transport(input, init);
    // Only collect numeric usage; never log the API key, prompts, or response body.
    if (response.ok) {
      try {
        const payload = await response.clone().json() as {
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (Number.isSafeInteger(payload.usage?.input_tokens) && Number.isSafeInteger(payload.usage?.output_tokens)) {
          inputTokens += payload.usage!.input_tokens!;
          outputTokens += payload.usage!.output_tokens!;
        } else tokenUsageComplete = false;
      } catch { tokenUsageComplete = false; }
    } else tokenUsageComplete = false;
    return response;
  };

  const models: AgentModels = {
    SUPPORT: createOpenAIModel({ apiKey: options.apiKey, model: options.model, role: 'SUPPORT', fetcher: meteredFetch }),
    INVENTORY: createOpenAIModel({ apiKey: options.apiKey, model: options.model, role: 'INVENTORY', fetcher: meteredFetch }),
    FULFILLMENT: createOpenAIModel({ apiKey: options.apiKey, model: options.model, role: 'FULFILLMENT', fetcher: meteredFetch }),
  };
  const results: LiveCaseResult[] = [];
  for (const item of cases) {
    if (requestsMade >= options.maxRequests) break;
    const started = performance.now();
    try {
      const answer = await runCommerceTask(item.question, repository, models, item.role);
      results.push({
        id: item.id, route: item.role, passed: answer.route === item.role && answer.toolCalls >= 1 && item.expected.test(answer.answer),
        toolCalls: answer.toolCalls, latencyMs: Math.round((performance.now() - started) * 100) / 100,
      });
    } catch (error) {
      results.push({
        id: item.id, route: item.role, passed: false, toolCalls: 0,
        latencyMs: Math.round((performance.now() - started) * 100) / 100,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      });
      if (requestsMade >= options.maxRequests) break;
    }
  }
  const latencies = results.map(item => item.latencyMs).sort((a, b) => a - b);
  const priced = tokenUsageComplete && options.inputPricePerMillion !== undefined && options.outputPricePerMillion !== undefined;
  const estimatedCostUsd = priced
    ? Math.round((inputTokens * options.inputPricePerMillion! + outputTokens * options.outputPricePerMillion!) / 1_000_000 * 1e6) / 1e6
    : null;
  const passed = results.filter(item => item.passed).length;
  return {
    mode: 'live-opt-in', model: options.model, generatedAt: new Date().toISOString(),
    requestCap: options.maxRequests, requestsMade, inputTokens, outputTokens, tokenUsageComplete,
    estimatedCostUsd, passed, failed: cases.length - passed, total: cases.length,
    latency: {
      averageMs: results.length ? Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length * 100) / 100 : 0,
      p95Ms: latencies.length ? latencies[Math.ceil(latencies.length * .95) - 1] : 0,
    },
    results,
  };
}
