export interface EvalCase {
  id: string;
  category: 'routing' | 'tool_result' | 'safety';
  run: () => Promise<boolean>;
}
export interface EvalCaseResult {
  id: string;
  category: EvalCase['category'];
  passed: boolean;
  latencyMs: number;
  error?: string;
}
export interface EvalReport {
  mode: 'offline-scripted';
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byCategory: Record<string, { passed: number; total: number }>;
  latency: { averageMs: number; p95Ms: number };
  results: EvalCaseResult[];
}
export async function runEvaluation(cases: EvalCase[]): Promise<EvalReport> {
  const results: EvalCaseResult[] = [];
  for (const testCase of cases) {
    const start = performance.now();
    try {
      const passed = await testCase.run();
      results.push({ id: testCase.id, category: testCase.category, passed, latencyMs: Math.round((performance.now() - start) * 100) / 100 });
    } catch (error) {
      results.push({
        id: testCase.id, category: testCase.category, passed: false,
        latencyMs: Math.round((performance.now() - start) * 100) / 100,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  const latencies = results.map(item => item.latencyMs).sort((a, b) => a - b);
  const passed = results.filter(item => item.passed).length;
  const byCategory: EvalReport['byCategory'] = {};
  for (const item of results) {
    byCategory[item.category] ??= { passed: 0, total: 0 };
    byCategory[item.category].total++;
    if (item.passed) byCategory[item.category].passed++;
  }
  return {
    mode: 'offline-scripted',
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? Math.round((passed / results.length) * 10000) / 100 : 0,
    byCategory,
    latency: {
      averageMs: results.length ? Math.round(results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length * 100) / 100 : 0,
      p95Ms: latencies.length ? latencies[Math.ceil(latencies.length * .95) - 1] : 0,
    },
    results,
  };
}
