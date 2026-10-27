# Autonomous Commerce Agents

A portfolio demo for learning production-minded **AI tool calling** on top of a TypeScript/Node.js/GraphQL/PostgreSQL backend. Uses **fictional e-commerce records only**.

## Run in GitHub Codespaces

Open the `feat/phase2-order-agent` branch in Codespaces. Then:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run dev
```

Keep forwarded port **4000 private** (Codespaces Ports panel). Visit the forwarded `/graphql` endpoint and try:

```graphql
query {
  order(id: "1042") { id status totalCents customer { name } }
  inventory { sku productName stockQuantity }
}
```

### Run tests without an API key

```bash
npm test
npm run typecheck
npm run build
```

All tests use fake repositories/models or stubbed HTTP, so they should not incur API charges and do not require PostgreSQL.

### Try the live read-only order agent (optional)

1. Get an OpenAI API key with available billing. In Codespaces, add it as a secret or place it in your untracked `.env` file. **Never commit or share the key.**
2. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`); restart `npm run dev`.
3. Execute this GraphQL mutation on the private forwarded port:

```graphql
mutation {
  askOrderAgent(question: "Where is order 1042?") {
    answer
    toolCalls
    events { type name detail }
  }
}
```

The model can choose a **single allowlisted read-only tool** (`get_order_status`) to look up fictional order status. The application validates tool arguments, limits tools to at most two per request, limits agent turns, prevents duplicate call IDs, and withholds customer names/emails from tool output. Unit and HTTP tests cover normal and failure scenarios.

## Structure

- `src/schema.ts`: GraphQL queries plus demo `askOrderAgent` mutation.
- `src/agent/order-agent.ts`: bounded tool execution and audit-event summary.
- `src/agent/openai-model.ts`: Responses API adapter; injectable fetch for tests.
- `src/db.ts`, `db/init.sql`: PostgreSQL read-only repository and fictional seed records.
- `tests/`: GraphQL API, agent, and API adapter tests.

## Limitations and safety

**Not production-ready.** The GraphQL server has no authentication or rate limits. Do not expose port 4000 publicly, connect real customers, or use live commerce data. The mutation initiates read-only agent queries, not order modifications. The live model provider stores response state during the tool loop, and API calls may incur charges. Never include credentials in repository files. Human approval workflows, durable event logs, tenant authorization, and structured evaluation benchmarks are future work.

## Portfolio description

You can truthfully describe this milestone as a **prototype of a bounded LLM-powered order-status agent with GraphQL/PostgreSQL integration and automated tests**, after the Codespaces checks and live demo are verified. Do not describe it as a deployed multi-agent platform.
