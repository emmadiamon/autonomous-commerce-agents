import { createYoga } from 'graphql-yoga';
import type { CommerceRepository } from './types.js';
import type { AgentModel } from './agent/types.js';
import type { AgentModels } from './agent/orchestrator.js';
import { buildSchema } from './schema.js';
import type { ApprovalService } from './approvals.js';
import type { AuditStore } from './audit.js';

export function createApp(repository: CommerceRepository, model?: AgentModel, models?: AgentModels, approvals?: ApprovalService, audit?: AuditStore) {
  return createYoga({ schema: buildSchema(repository, model, models, approvals, audit), graphqlEndpoint: '/graphql', landingPage: true });
}
