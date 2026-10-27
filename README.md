# Autonomous Commerce Agents

Phase 1: a minimal, read-only **TypeScript + Node.js + GraphQL + PostgreSQL** backend using fictional e-commerce data. **No AI agent is implemented yet.**

## GitHub Codespaces quickstart

1. Open branch `feat/phase1-graphql-postgres` in Codespaces. Rebuild the dev container if already using an older Codespace configuration.
2. Run these commands in the Codespaces terminal:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run dev
```

3. Open forwarded port 4000, then visit `/graphql` and execute:

```graphql
query {
  health
  order(id: "1042") { id status totalCents customer { name } }
  inventory { sku productName stockQuantity }
}
```

4. In another terminal verify:

```bash
npm test
npm run typecheck
npm run build
```

The first PostgreSQL launch seeds fictional customers, orders and inventory from `db/init.sql`. Compose persists database state in a named volume. If you alter the SQL later, it will not rerun automatically on an existing volume.

## GraphQL queries

- `health`: service health string.
- `order(id: ID!)`: one order or null for an unknown ID.
- `orders`: all mock orders.
- `inventory`: seeded product inventory.

Prices are represented in integer cents (`totalCents`) rather than floating point dollars.

## Files and design

- `src/types.ts`: domain models and repository interface.
- `src/db.ts`: PostgreSQL read queries using parameterized SQL.
- `src/schema.ts`: GraphQL schema and resolvers.
- `src/app.ts`, `src/server.ts`: Yoga HTTP application and Node server.
- `tests/schema.test.ts`: GraphQL tests with a fake repository (no database required).
- `db/init.sql`: fictional seed data.
- `.devcontainer/devcontainer.json`: Codespaces Node.js/Docker environment.

## Boundaries

**Development demo only.** There is no authentication, authorization, real customer information, public production deployment, write mutation, or autonomous AI agent. Do not expose this service publicly or connect real orders without security controls. Never commit a `.env` file. Phase 2 will implement bounded AI tool calling, evaluation, and human approval for high-impact actions.

For your portfolio, accurately describe Phase 1 as an e-commerce GraphQL/PostgreSQL backend scaffold until AI agents are truly implemented and tested.
