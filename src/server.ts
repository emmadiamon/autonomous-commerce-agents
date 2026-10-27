import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createPostgresRepository } from './db.js';
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
const server = createServer(createApp(repository, model, models));
server.listen(port, '0.0.0.0', () => console.log(`GraphQL ready at http://localhost:${port}/graphql; agents ${models ? 'configured' : 'disabled (no API key)'}`));

async function shutdown() {
  server.close();
  await close();
}
process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
