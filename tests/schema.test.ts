import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { CommerceRepository } from '../src/types.js';

const repository: CommerceRepository = {
  getOrder: async id => id === 1042 ? { id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 } : null,
  listOrders: async () => [{ id: 1042, customerId: 1, status: 'SHIPPED', totalCents: 2999 }],
  getCustomer: async id => id === 1 ? { id: 1, name: 'Avery Chen', email: 'avery@example.test' } : null,
  listInventory: async () => [{ sku: 'STICKER-001', productName: 'Die-cut sticker pack', stockQuantity: 120 }],
};

const app = createApp(repository);

// Exercise the same HTTP GraphQL handler used by the server rather than mixing
// two GraphQL runtime instances by calling graphql() directly in Vitest.
async function query(source: string): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> {
  const response = await app.fetch(new Request('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: source }),
  }));
  return response.json() as Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }>;
}

describe('Commerce GraphQL API', () => {
  it('returns health without database calls', async () => {
    const result = await query('{ health }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.health).toBe('ok');
  });

  it('retrieves a seeded order and its customer', async () => {
    const result = await query('{ order(id: "1042") { id status totalCents customer { name } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.order).toEqual({ id: '1042', status: 'SHIPPED', totalCents: 2999, customer: { name: 'Avery Chen' } });
  });

  it('returns null for missing order', async () => {
    const result = await query('{ order(id: "9999") { id } }');
    expect(result.data?.order).toBeNull();
  });

  it('rejects invalid order ID', async () => {
    const result = await query('{ order(id: "not-a-number") { id } }');
    expect(result.errors?.[0]?.message).toContain('positive integer');
  });

  it('lists inventory', async () => {
    const result = await query('{ inventory { sku stockQuantity } }');
    expect(result.data?.inventory).toEqual([{ sku: 'STICKER-001', stockQuantity: 120 }]);
  });
});
