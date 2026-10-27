import { createSchema } from 'graphql-yoga';
import type { CommerceRepository, Order } from './types.js';
import { runOrderAgent } from './agent/order-agent.js';
import type { AgentModel } from './agent/types.js';

export function buildSchema(repository: CommerceRepository, model?: AgentModel) {
  return createSchema({
    typeDefs: /* GraphQL */ `
      enum OrderStatus { PROCESSING SHIPPED DELIVERED CANCELLED }
      type Customer { id: ID! name: String! email: String! }
      type Order { id: ID! customerId: ID! status: OrderStatus! totalCents: Int! customer: Customer }
      type InventoryItem { sku: ID! productName: String! stockQuantity: Int! }
      type AgentEvent { type: String! name: String detail: String! }
      type AgentAnswer { answer: String! toolCalls: Int! events: [AgentEvent!]! }
      type Query {
        health: String!
        order(id: ID!): Order
        orders: [Order!]!
        inventory: [InventoryItem!]!
      }
      type Mutation {
        askOrderAgent(question: String!): AgentAnswer!
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
      },
      Mutation: {
        askOrderAgent: (_parent, args: { question: string }) => {
          if (!model) throw new Error('Agent model is not configured');
          return runOrderAgent(args.question, repository, model);
        },
      },
      Order: {
        customer: (parent: Order) => repository.getCustomer(parent.customerId),
      },
    },
  });
}
