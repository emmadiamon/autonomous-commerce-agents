import { createYoga } from 'graphql-yoga';
import type { CommerceRepository } from './types.js';
import type { AgentModel } from './agent/types.js';
import { buildSchema } from './schema.js';

export function createApp(repository: CommerceRepository, model?: AgentModel) {
  return createYoga({ schema: buildSchema(repository, model), graphqlEndpoint: '/graphql', landingPage: true });
}
