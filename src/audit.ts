export type AuditEvent = {
  id: number;
  category: 'APPROVAL' | 'AGENT';
  action: string;
  actor: string;
  subject: string;
  outcome: 'SUCCESS' | 'FAILED';
  toolCalls: number | null;
  durationMs: number | null;
  createdAt: string;
};
export type AuditStore = {
  list(): Promise<AuditEvent[]>;
  recordAgent(role: string, outcome: 'SUCCESS' | 'FAILED', toolCalls: number | null, durationMs: number): Promise<void>;
};

export function createMemoryAuditStore(): AuditStore {
  const events: AuditEvent[] = [];
  return {
    list: async () => [...events].reverse(),
    recordAgent: async (role, outcome, toolCalls, durationMs) => {
      events.push({
        id: events.length + 1, category: 'AGENT', action: 'AGENT_RUN',
        actor: 'demo-admin', subject: role, outcome, toolCalls, durationMs,
        createdAt: new Date().toISOString(),
      });
    },
  };
}
