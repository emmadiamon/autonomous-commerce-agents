import { describe, expect, it } from 'vitest';
import { runEvaluation } from '../src/evaluation/harness.js';
import { buildOfflineScenarios } from '../src/evaluation/scenarios.js';

describe('Offline evaluation harness', () => {
  it('runs all seeded scenarios and reports results', async () => {
    const report = await runEvaluation(buildOfflineScenarios());
    expect(report.mode).toBe('offline-scripted');
    expect(report.total).toBe(14);
    expect(report.failed).toBe(0);
    expect(report.byCategory.routing).toEqual({ passed: 4, total: 4 });
    expect(report.byCategory.tool_result).toEqual({ passed: 5, total: 5 });
    expect(report.byCategory.safety).toEqual({ passed: 5, total: 5 });
  });
  it('records failures without stopping the suite', async () => {
    const report = await runEvaluation([
      { id: 'exception', category: 'safety', run: async () => { throw new Error('test failure'); } },
      { id: 'pass', category: 'routing', run: async () => true },
    ]);
    expect(report).toMatchObject({ total: 2, passed: 1, failed: 1, passRate: 50 });
    expect(report.results[0].error).toBe('test failure');
  });
});
