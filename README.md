# Autonomous Commerce Agents

A TypeScript/Node.js/GraphQL/PostgreSQL portfolio prototype demonstrating read-only AI tool calling and **three specialized agents** over fictional e-commerce data.

## Quickstart in GitHub Codespaces

Open `feat/phase3-multi-agent`, then:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm test
npm run typecheck
npm run build
npm run dev
```

If you already have a local `.env`, **do not overwrite it**. Keep Codespaces port 4000 **Private**. Open the forwarded URL's `/graphql` path.

Without `OPENAI_API_KEY`, the deterministic tests work, but live agent mutations will be disabled. To test the live model, add `OPENAI_API_KEY` in your Codespaces repository secrets and restart the Codespace. API requests can incur costs.

### Multi-agent mutation

```graphql
mutation {
  askCommerceAgent(question: "Which products have low stock?") {
    route
    answer
    toolCalls
    events { type name detail }
  }
}
```

Try these separately:

- `"Which products have low stock?"` → inventory agent with `get_low_stock`.
- `"Show processing orders backlog"` → fulfillment agent with `get_processing_orders`.
- `"Where is order 1042?"` → customer support agent with `get_order_status`.

You can explicitly choose a role:

```graphql
mutation {
  askCommerceAgent(question: "Summarize the backlog", route: FULFILLMENT) {
    route answer toolCalls
  }
}
```

Previous `askOrderAgent` remains available for compatibility.

## Architecture

1. A deterministic keyword router selects SUPPORT, FULFILLMENT or INVENTORY. The user can override via GraphQL enum.
2. Each role receives only one read-only model tool.
3. The backend validates tool names and arguments, limits to 2 tool calls and 4 turns, rejects duplicate call IDs, and returns safe audit-event summaries.
4. PostgreSQL provides fictional order and inventory data.
5. Tests use stubbed model responses so they need no API key or live model charges.

Order support reads one order status; fulfillment lists **PROCESSING** orders; inventory finds products below an integer stock threshold (1-100).

**Important:** PROCESSING status is not proof an order is delayed. Real delay detection would need shipped/due timestamps and business rules.

## Security and limitations

This is **not production-ready**: no authentication, tenant-level authorization, rate limits, durable audit database, external messaging, or order modifications. Keep your Codespaces port private. Do not use live customer information. An order lookup is read-only, and all agents lack write tools. Do not commit API keys or `.env`.

## Suggested truthful portfolio description

After verifying tests and a live demo: *Built a prototype multi-agent e-commerce operations system with deterministic task routing, specialized LLM function calls, GraphQL/PostgreSQL integration, safety limits, and automated tests.* Do not claim production deployment or actual customer outcomes.
