import type { CommerceRepository } from './types.js';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApprovalProposal = {
  id: number; sku: string; productName: string; currentStock: number;
  recommendedQuantity: number; reason: string; status: ApprovalStatus;
  createdAt: string; reviewedAt: string | null;
};
export type ApprovalStore = {
  list(): Promise<ApprovalProposal[]>;
  create(input: Omit<ApprovalProposal, 'id' | 'status' | 'createdAt' | 'reviewedAt'>): Promise<ApprovalProposal>;
  decide(id: number, decision: 'APPROVED' | 'REJECTED'): Promise<ApprovalProposal | null>;
};

export function createApprovalService(repository: CommerceRepository, store: ApprovalStore) {
  return {
    list: () => store.list(),
    async recommend(sku: string) {
      if (!sku || sku.length > 100) throw new Error('Invalid SKU');
      const items = await repository.listInventory();
      const item = items.find(row => row.sku === sku);
      if (!item) throw new Error('Unknown SKU');
      if (item.stockQuantity > 10) throw new Error('Only low-stock items can be recommended');
      // Fixed target for this fictional demo, not a production replenishment policy.
      return store.create({
        sku: item.sku, productName: item.productName, currentStock: item.stockQuantity,
        recommendedQuantity: 30 - item.stockQuantity,
        reason: 'Illustrative proposal to replenish inventory to 30 units; no purchase order is sent.',
      });
    },
    async decide(id: number, decision: 'APPROVED' | 'REJECTED') {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid approval ID');
      if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('Invalid decision');
      const proposal = await store.decide(id, decision);
      if (!proposal) throw new Error('Proposal not found or already decided');
      return proposal;
    },
  };
}

export type ApprovalService = ReturnType<typeof createApprovalService>;

// Deterministic in-memory store for unit tests only; production uses PostgreSQL.
export function createMemoryApprovalStore(): ApprovalStore {
  const proposals: ApprovalProposal[] = [];
  return {
    list: async () => proposals.map(item => ({ ...item })).reverse(),
    create: async input => {
      const existing = proposals.find(item => item.sku === input.sku && item.status === 'PENDING');
      if (existing) return { ...existing };
      const proposal: ApprovalProposal = {
        ...input, id: proposals.length + 1, status: 'PENDING',
        createdAt: new Date().toISOString(), reviewedAt: null,
      };
      proposals.push(proposal);
      return { ...proposal };
    },
    decide: async (id, decision) => {
      const item = proposals.find(row => row.id === id && row.status === 'PENDING');
      if (!item) return null;
      item.status = decision;
      item.reviewedAt = new Date().toISOString();
      return { ...item };
    },
  };
}
