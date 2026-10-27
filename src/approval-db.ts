import { Pool } from 'pg';
import type { ApprovalProposal, ApprovalStore } from './approvals.js';
import type { AuditEvent, AuditStore } from './audit.js';

type DbProposal = {
  id: number; sku: string; productName: string; currentStock: number;
  recommendedQuantity: number; reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date; reviewedAt: Date | null;
};
type DbAudit = Omit<AuditEvent, 'createdAt'> & { createdAt: Date };

const fields = `id, sku, product_name AS "productName", current_stock AS "currentStock",
  recommended_quantity AS "recommendedQuantity", reason, status,
  created_at AS "createdAt", reviewed_at AS "reviewedAt"`;
function serialize(row: DbProposal): ApprovalProposal {
  return { ...row, createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null };
}

export function createPostgresApprovalStore(connectionString: string) {
  const pool = new Pool({ connectionString, max: 2 });
  const initialize = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS approval_proposals (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        sku TEXT NOT NULL,
        product_name TEXT NOT NULL,
        current_stock INTEGER NOT NULL CHECK (current_stock >= 0),
        recommended_quantity INTEGER NOT NULL CHECK (recommended_quantity > 0),
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS one_pending_approval_per_sku
      ON approval_proposals (sku) WHERE status = 'PENDING'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commerce_audit_events (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        category TEXT NOT NULL CHECK (category IN ('APPROVAL','AGENT')),
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        subject TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('SUCCESS','FAILED')),
        tool_calls INTEGER,
        duration_ms DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  };
  const store: ApprovalStore = {
    async list() {
      const result = await pool.query<DbProposal>(`SELECT ${fields} FROM approval_proposals ORDER BY created_at DESC, id DESC LIMIT 100`);
      return result.rows.map(serialize);
    },
    async create(input) {
      const result = await pool.query<DbProposal>(`
        INSERT INTO approval_proposals
          (sku, product_name, current_stock, recommended_quantity, reason)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (sku) WHERE status = 'PENDING' DO UPDATE
          SET sku = EXCLUDED.sku
        RETURNING ${fields}
      `, [input.sku, input.productName, input.currentStock, input.recommendedQuantity, input.reason]);
      return serialize(result.rows[0]);
    },
    async decide(id, decision) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<DbProposal>(`
          UPDATE approval_proposals SET status = $2, reviewed_at = now()
          WHERE id = $1 AND status = 'PENDING'
          RETURNING ${fields}
        `, [id, decision]);
        const row = result.rows[0];
        if (!row) {
          await client.query('ROLLBACK');
          return null;
        }
        // Both the state change and its audit event commit together.
        await client.query(`
          INSERT INTO commerce_audit_events (category, action, actor, subject, outcome)
          VALUES ('APPROVAL', $1, 'demo-admin', $2, 'SUCCESS')
        `, [decision, String(id)]);
        await client.query('COMMIT');
        return serialize(row);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
  const audit: AuditStore = {
    async list() {
      const result = await pool.query<DbAudit>(`
        SELECT id, category, action, actor, subject, outcome,
          tool_calls AS "toolCalls", duration_ms AS "durationMs", created_at AS "createdAt"
        FROM commerce_audit_events ORDER BY id DESC LIMIT 100
      `);
      return result.rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
    },
    async recordAgent(role, outcome, toolCalls, durationMs) {
      await pool.query(`
        INSERT INTO commerce_audit_events (category, action, actor, subject, outcome, tool_calls, duration_ms)
        VALUES ('AGENT','AGENT_RUN','demo-admin',$1,$2,$3,$4)
      `, [role, outcome, toolCalls, durationMs]);
    },
  };
  return { store, audit, initialize, close: () => pool.end() };
}
