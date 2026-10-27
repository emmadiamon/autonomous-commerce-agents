import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createApp } from './app.js';
import { createPostgresRepository } from './db.js';
import { createPostgresApprovalStore } from './approval-db.js';
import { createApprovalService } from './approvals.js';
import { createOpenAIModel } from './agent/openai-model.js';
import type { AgentModels } from './agent/orchestrator.js';

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port');
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

const files: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/dashboard': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/dashboard.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/dashboard.js': { file: 'dashboard.js', type: 'text/javascript; charset=utf-8' },
};

async function start() {
  await approvals.initialize();
  const yoga = createApp(repository, model, models, createApprovalService(repository, approvals.store));
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const asset = request.method === 'GET' ? files[path] : undefined;
    if (!asset) { void yoga(request, response); return; }
    // Exact allow-list keeps the static file server from traversing directories.
    const assetUrl = new URL('../dashboard/' + asset.file, import.meta.url);
    void readFile(assetUrl).then(data => {
      response.writeHead(200, {
        'content-type': asset.type,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
      });
      response.end(data);
    }).catch(() => {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end('Dashboard unavailable');
    });
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Dashboard http://localhost:${port}/dashboard | GraphQL http://localhost:${port}/graphql; agents ${models ? 'configured' : 'disabled'}`);
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
