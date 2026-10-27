import { describe, expect, it } from 'vitest';
import { createApprovalService, createMemoryApprovalStore } from '../src/approvals.js';
import { createApp } from '../src/app.js';
import type { CommerceRepository } from '../src/types.js';

const repository: CommerceRepository = {
  getOrder: async () => null,
  listOrders: async () => [],
  getCustomer: async () => null,
  listInventory: async () => [
    { sku: 'SHIRT-002', productName: 'Cotton T-shirt', stockQuantity: 8 },
    { sku: 'STICKER-001', productName: 'Sticker pack', stockQuantity: 120 },
  ],
};

describe('Phase 6 human approvals', () => {
  it('creates a proposal and never changes inventory', async () => {
    const workflow = createApprovalService(repository, createMemoryApprovalStore());
    const proposal = await workflow.recommend('SHIRT-002');
    expect(proposal).toMatchObject({
      id: 1, sku: 'SHIRT-002', currentStock: 8, recommendedQuantity: 22, status: 'PENDING',
    });
    expect(await workflow.recommend('SHIRT-002')).toMatchObject({ id: 1 });
    expect((await repository.listInventory())[0].stockQuantity).toBe(8);
    await expect(workflow.recommend('STICKER-001')).rejects.toThrow('low-stock');
  });

  it('enforces one-way approvals and rejections', async () => {
    const workflow = createApprovalService(repository, createMemoryApprovalStore());
    const p = await workflow.recommend('SHIRT-002');
    const approved = await workflow.decide(p.id, 'APPROVED');
    expect(approved?.status).toBe('APPROVED');
    expect(approved?.reviewedAt).toBeTruthy();
    await expect(workflow.decide(p.id, 'REJECTED')).rejects.toThrow('already decided');
    await expect(workflow.decide(0, 'APPROVED')).rejects.toThrow('Invalid approval ID');
    const second = await workflow.recommend('SHIRT-002');
    expect(second.id).toBe(2);
    expect((await workflow.decide(second.id, 'REJECTED'))?.status).toBe('REJECTED');
  });

  it('exposes proposal lifecycle through GraphQL', async () => {
    const workflow = createApprovalService(repository, createMemoryApprovalStore());
    const app = createApp(repository, undefined, undefined, workflow);
    async function query(source: string) {
      const response = await app.fetch(new Request('http://localhost/graphql', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: source }),
      }));
      return response.json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;
    }
    const created = await query('mutation { recommendReplenishment(sku:"SHIRT-002") { id status recommendedQuantity } }');
    expect(created.errors).toBeUndefined();
    expect(created.data?.recommendReplenishment).toEqual({ id: '1', status: 'PENDING', recommendedQuantity: 22 });
    const reviewed = await query('mutation { reviewApproval(id:"1", decision:APPROVED) { id status } }');
    expect(reviewed.data?.reviewApproval).toEqual({ id: '1', status: 'APPROVED' });
    const listed = await query('{ approvalProposals { id status } }');
    expect(listed.data?.approvalProposals).toEqual([{ id: '1', status: 'APPROVED' }]);
  });
});
