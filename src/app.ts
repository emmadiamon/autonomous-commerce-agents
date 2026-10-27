import { createYoga } from 'graphql-yoga';
import type { CommerceRepository } from './types.js';
import { buildSchema } from './schema.js';

export function createApp(repository: CommerceRepository) {
  return createYoga({ schema: buildSchema(repository), graphqlEndpoint: '/graphql', landingPage: true });
}
