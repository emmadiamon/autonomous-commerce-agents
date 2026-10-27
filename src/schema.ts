import { createSchema } from 'graphql-yoga';
import type { CommerceRepository, Order } from './types.js';
import { runOrderAgent } from './agent/order-agent.js';
import { runCommerceTask } from './agent/orchestrator.js';
import type { AgentModels, AgentRole } from './agent/orchestrator.js';
import type { AgentModel } from './agent/types.js';
import type { ApprovalService } from './approvals.js';

export function buildSchema(repository: CommerceRepository, model?: AgentModel, models?: AgentModels, approvals?: ApprovalService) {
  return createSchema({
    typeDefs: /* GraphQL */ `
      enum OrderStatus { PROCESSING SHIPPED DELIVERED CANCELLED }
      enum AgentRoute { SUPPORT FULFILLMENT INVENTORY }
      type Customer { id: ID! name: String! email: String! }
      type Order { id: ID! customerId: ID! status: OrderStatus! totalCents: Int! customer: Customer }
      type InventoryItem { sku: ID! productName: String! stockQuantity: Int! }
      enum ApprovalStatus { PENDING APPROVED REJECTED }
      enum ApprovalDecision { APPROVED REJECTED }
      type ApprovalProposal { id: ID! sku: String! productName: String! currentStock: Int! recommendedQuantity: Int! reason: String! status: ApprovalStatus! createdAt: String! reviewedAt: String }
      type AgentEvent { type: String! name: String detail: String! }
      type AgentAnswer { answer: String! toolCalls: Int! events: [AgentEvent!]! }
      type CommerceAgentAnswer { route: AgentRoute! answer: String! toolCalls: Int! events: [AgentEvent!]! }
      type Query {
        health: String!
        order(id: ID!): Order
        orders: [Order!]!
        inventory: [InventoryItem!]!
        approvalProposals: [ApprovalProposal!]!
      }
      type Mutation {
        askOrderAgent(question: String!): AgentAnswer!
        askCommerceAgent(question: String!, route: AgentRoute): CommerceAgentAnswer!
        recommendReplenishment(sku: String!): ApprovalProposal!
        reviewApproval(id: ID!, decision: ApprovalDecision!): ApprovalProposal!
      }
    `,
    resolvers: {
      Query: {
        health: () => 'ok',
        order: (_parent, args: { id: string }) => {
          const id = Number(args.id);
          if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Order ID must be a positive integer');
          return repository.getOrder(id);
        },
        orders: () => repository.listOrders(),
        inventory: () => repository.listInventory(),
        approvalProposals: () => approvals?.list() ?? [],
      },
      Mutation: {
        recommendReplenishment: (_parent, args: { sku: string }) => {
          if (!approvals) throw new Error('Approval workflow is unavailable');
          return approvals.recommend(args.sku);
        },
        reviewApproval: (_parent, args: { id: string; decision: 'APPROVED' | 'REJECTED' }) => {
          if (!approvals) throw new Error('Approval workflow is unavailable');
          return approvals.decide(Number(args.id), args.decision);
        },
        askOrderAgent: (_parent, args: { question: string }) => {
          if (!model) throw new Error('Agent model is not configured');
          return runOrderAgent(args.question, repository, model);
        },
        askCommerceAgent: (_parent, args: { question: string; route?: AgentRole }) => {
          if (!models) throw new Error('Agent models are not configured');
          return runCommerceTask(args.question, repository, models, args.route);
        },
      },
      Order: {
        customer: (parent: Order) => repository.getCustomer(parent.customerId),
      },
    },
  });
}
