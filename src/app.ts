import { createYoga } from 'graphql-yoga';
import type { CommerceRepository } from './types.js';
import type { AgentModel } from './agent/types.js';
import type { AgentModels } from './agent/orchestrator.js';
import { buildSchema } from './schema.js';
import type { ApprovalService } from './approvals.js';

export function createApp(repository: CommerceRepository, model?: AgentModel, models?: AgentModels, approvals?: ApprovalService) {
  return createYoga({ schema: buildSchema(repository, model, models, approvals), graphqlEndpoint: '/graphql', landingPage: true });
}
