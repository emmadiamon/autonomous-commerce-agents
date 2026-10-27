import 'dotenv/config';
import { runLiveEvaluation } from '../src/evaluation/live.js';

if (!process.argv.includes('--confirm-live')) {
  process.stderr.write('Live API calls cost money. Re-run with --confirm-live to explicitly opt in.\n');
  process.exitCode = 2;
} else {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const maxRequests = Number(process.env.LIVE_EVAL_MAX_REQUESTS ?? '9');
  const parseRate = (name: string): number | undefined => {
    const value = process.env[name];
    return value === undefined || value.trim() === '' ? undefined : Number(value);
  };
  try {
    const report = await runLiveEvaluation({
      apiKey, model, maxRequests,
      inputPricePerMillion: parseRate('LIVE_EVAL_INPUT_USD_PER_1M'),
      outputPricePerMillion: parseRate('LIVE_EVAL_OUTPUT_USD_PER_1M'),
    });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.stdout.write('Estimated cost is not an invoice; rates must be supplied for the exact model. Request cap is NOT a dollar cap.\n');
    if (report.failed > 0 || report.requestsMade >= report.requestCap && report.results.length < report.total) process.exitCode = 1;
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'Live evaluation failed') + '\n');
    process.exitCode = 1;
  }
}
