import { runEvaluation } from '../src/evaluation/harness.js';
import { buildOfflineScenarios } from '../src/evaluation/scenarios.js';

const report = await runEvaluation(buildOfflineScenarios());
const asJson = process.argv.includes('--json');
if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  process.stdout.write('OFFLINE SCRIPTED EVALUATION (not a live-model benchmark)\n');
  process.stdout.write(`Passed: ${report.passed}/${report.total} (${report.passRate}%)\n`);
  for (const [category, scores] of Object.entries(report.byCategory)) {
    process.stdout.write(`  ${category}: ${scores.passed}/${scores.total}\n`);
  }
  process.stdout.write(`Harness latency: avg ${report.latency.averageMs}ms, p95 ${report.latency.p95Ms}ms\n`);
  for (const result of report.results) {
    process.stdout.write(`[${result.passed ? 'PASS' : 'FAIL'}] ${result.id}${result.error ? ': ' + result.error : ''}\n`);
  }
  process.stdout.write('This measures deterministic routing, tool outputs and safety guards with scripted model calls.\n');
  process.stdout.write('It does NOT measure live LLM accuracy, model latency, token costs, or production reliability.\n');
}
if (report.failed) process.exitCode = 1;
