import 'dotenv/config';
import { Pool } from 'pg';
import type { CommerceRepository, Customer, InventoryItem, Order } from './types.js';

export function createPostgresRepository(connectionString = process.env.DATABASE_URL): { repository: CommerceRepository; close: () => Promise<void> } {
  if (!connectionString) throw new Error('DATABASE_URL is required. Copy .env.example to .env.');
  const pool = new Pool({ connectionString, max: 5 });
  const repository: CommerceRepository = {
    async getOrder(id) {
      const result = await pool.query<Order>('SELECT id, customer_id AS "customerId", status, total_cents AS "totalCents" FROM orders WHERE id=$1', [id]);
      return result.rows[0] ?? null;
    },
    async listOrders() {
      const result = await pool.query<Order>('SELECT id, customer_id AS "customerId", status, total_cents AS "totalCents" FROM orders ORDER BY id');
      return result.rows;
    },
    async getCustomer(id) {
      const result = await pool.query<Customer>('SELECT id, name, email FROM customers WHERE id=$1', [id]);
      return result.rows[0] ?? null;
    },
    async listInventory() {
      const result = await pool.query<InventoryItem>('SELECT sku, product_name AS "productName", stock_quantity AS "stockQuantity" FROM inventory ORDER BY sku');
      return result.rows;
    },
  };
  return { repository, close: async () => { await pool.end(); } };
}
