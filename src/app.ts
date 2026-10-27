import { createYoga } from 'graphql-yoga';
import type { CommerceRepository } from './types.js';
import type { AgentModel } from './agent/types.js';
import type { AgentModels } from './agent/orchestrator.js';
import { buildSchema } from './schema.js';

export function createApp(repository: CommerceRepository, model?: AgentModel, models?: AgentModels) {
  return createYoga({ schema: buildSchema(repository, model, models), graphqlEndpoint: '/graphql', landingPage: true });
}
