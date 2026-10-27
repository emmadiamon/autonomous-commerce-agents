import 'dotenv/config';
import { createApp } from './app.js';
import { createPostgresRepository } from './db.js';
import { createPostgresApprovalStore } from './approval-db.js';
import { createApprovalService } from './approvals.js';
import { createOpenAIModel } from './agent/openai-model.js';
import type { AgentModels } from './agent/orchestrator.js';
import { createSessionAuth } from './session-auth.js';
import { createSecureServer } from './secure-server.js';

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port');
const password = process.env.DASHBOARD_ADMIN_PASSWORD ?? '';
// Fail closed: never start an unauthenticated dashboard if its password is missing.
const auth = createSessionAuth(password);
const { repository, close } = createPostgresRepository();
const apiKey = process.env.OPENAI_API_KEY;
const model = apiKey ? createOpenAIModel({ apiKey, model: process.env.OPENAI_MODEL }) : undefined;
const models: AgentModels | undefined = apiKey ? {
  SUPPORT: createOpenAIModel({ apiKey, model: process.env.OPENAI_MODEL, role: 'SUPPORT' }),
  FULFILLMENT: createOpenAIModel({ apiKey, model: process.env.OPENAI_MODEL, role: 'FULFILLMENT' }),
  INVENTORY: createOpenAIModel({ apiKey, model: process.env.OPENAI_MODEL, role: 'INVENTORY' }),
} : undefined;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const approvals = createPostgresApprovalStore(connectionString);

async function start() {
  await approvals.initialize();
  const yoga = createApp(repository, model, models,
    createApprovalService(repository, approvals.store), approvals.audit);
  const server = createSecureServer(yoga, auth);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Private CommerceOS dashboard http://localhost:${port}/dashboard | authenticated GraphQL /graphql; agents ${models ? 'configured' : 'disabled'}`);
  });
  async function shutdown() {
    server.close();
    await Promise.all([close(), approvals.close()]);
  }
  process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
}
start().catch(error => {
  console.error('Startup failed:', error instanceof Error ? error.message : 'unknown error');
  void Promise.all([close(), approvals.close()]).finally(() => { process.exitCode = 1; });
});
