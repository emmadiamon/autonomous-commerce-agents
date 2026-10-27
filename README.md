# Autonomous Commerce Agents

A TypeScript/Node.js/GraphQL/PostgreSQL portfolio prototype demonstrating read-only AI tool calling and **three specialized agents** over fictional e-commerce data. Phase 4 adds reproducible, offline scripted evaluations.

## Quickstart in GitHub Codespaces

Open `feat/phase4-evaluations`, then:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm test
npm run typecheck
npm run build
npm run eval
```

If you already have a local `.env`, **do not overwrite it**. The unit tests and offline evaluations do not require the database or an OpenAI API key. PostgreSQL is needed for the running GraphQL server. To start the GraphQL API:

```bash
npm run dev
```

Keep Codespaces port 4000 **Private**. Open the forwarded URL's `/graphql` path.

Without `OPENAI_API_KEY`, the deterministic tests and evaluations work, but live agent mutations will be disabled. To test the live model, add `OPENAI_API_KEY` in your Codespaces repository secrets and restart the Codespace. Live API requests can incur costs.

## Phase 4: Offline scripted evaluations

```bash
npm run eval
npm run eval:json
```

The evaluation harness executes 14 deterministic cases across three categories:

- **Routing (4):** questions about inventory, order-processing backlog, shipping, and general support route to their expected specialists.
- **Tool results (5):** valid and missing order lookup, low-stock and no-low-stock inventory, and processing orders return expected structured results.
- **Safety (5):** disallowed refund tool, cross-role tool, invalid inventory threshold, invalid order ID, and overlong question are rejected.

The report shows pass/fail by case and category, pass rate, and in-process average and p95 latency. `npm run eval:json` produces machine-readable output. Any failed scenario exits with a nonzero status code.

**What this evaluates:** local orchestration, tool validation, fixed output contracts, and error handling with stubbed model turns and an in-memory repository.

**What this does not evaluate:** live LLM reasoning quality, production security, real customer data accuracy, API token usage/cost, or real OpenAI request latency. Passing scripted cases does not establish a live-model accuracy percentage. Live evaluation should be a separate opt-in step with a cost budget.

## Multi-agent mutation

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
4. PostgreSQL provides fictional order and inventory data when running the server.
5. Unit tests and Phase 4 evaluations use stubbed model responses, without an API key or live model charges.

Order support reads one order status; fulfillment lists **PROCESSING** orders; inventory finds products below an integer stock threshold (1-100).

**Important:** PROCESSING status is not proof an order is delayed. Real delay detection would need shipped/due timestamps and business rules.

## Security and limitations

This is **not production-ready**: no authentication, tenant-level authorization, rate limits, durable audit database, external messaging, or order modifications. Keep your Codespaces port private. Do not use live customer information. All agents lack write tools. Do not commit API keys or `.env`.

## Suggested truthful portfolio description

After verifying tests and a live demo: *Built a prototype multi-agent e-commerce operations system with deterministic task routing, specialized LLM function calls, GraphQL/PostgreSQL integration, safety limits, automated tests, and a 14-scenario offline scripted evaluation harness.* Do not claim production deployment, real-model evaluation scores, or actual customer outcomes.
