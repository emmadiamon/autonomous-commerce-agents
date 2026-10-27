import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createPostgresRepository } from './db.js';
import { createOpenAIModel } from './agent/openai-model.js';

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port');
const { repository, close } = createPostgresRepository();
const model = process.env.OPENAI_API_KEY ? createOpenAIModel({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }) : undefined;
const server = createServer(createApp(repository, model));
server.listen(port, '0.0.0.0', () => console.log(`GraphQL ready at http://localhost:${port}/graphql; agent ${model ? 'configured' : 'disabled (no API key)'}`));

async function shutdown() {
  server.close();
  await close();
}
process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
