# Autonomous Commerce Agents

A TypeScript/Node.js/GraphQL/PostgreSQL portfolio prototype demonstrating read-only AI tool calling and **three specialized agents** over fictional e-commerce data. Phase 4 adds reproducible offline scripted evaluations; Phase 5 adds an explicitly opt-in live-model evaluation.

## Quickstart in GitHub Codespaces

Open `feat/phase7-auth-audit`, then:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm test
npm run typecheck
npm run build
npm run eval
```

If you already have a local `.env`, **do not overwrite it**. The unit tests and offline evaluations do not require the database or an OpenAI API key. PostgreSQL is needed for the running GraphQL server. To start the dashboard and GraphQL API:

```bash
npm run dev
```

Keep Codespaces port 4000 **Private**. Sign in through the forwarded port URL at `/dashboard`; `/graphql` is now session-protected.

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

## Phase 5: Opt-in live-model evaluation

The Phase 4 `npm run eval` suite still runs offline for free. Phase 5 adds **three fixed live questions** against fictional orders/inventory. It records routing, tool usage, factual answer checks, per-scenario wall-clock latency, successful-response API token usage, and optional estimated token cost.

**No live API requests happen during `npm test`, `npm run eval`, or `npm run eval:json`.** The live command requires the explicit `--confirm-live` flag:

```bash
# Use your Codespaces OPENAI_API_KEY secret. Do not print or paste its value.
npm run eval:live -- --confirm-live
```

By default the live runner permits at most **9 attempted HTTP requests** across three scenarios. To reduce exposure, set a lower limit (some cases might stop unfinished):

```bash
LIVE_EVAL_MAX_REQUESTS=6 npm run eval:live -- --confirm-live
```

This cap is per run, counts failed HTTP attempts, and cannot exceed 9. **It is not a dollar cap**; repeated runs can still incur charges. The tool does not automatically contact any payment or billing API. Your existing OpenAI billing controls remain separate.

Optional, only if you've independently confirmed current standard token rates for **your selected model**, supply USD per **one million** input/output tokens:

```bash
LIVE_EVAL_INPUT_USD_PER_1M=0.40 LIVE_EVAL_OUTPUT_USD_PER_1M=1.60 npm run eval:live -- --confirm-live
```

The above rate numbers are placeholders for the syntax, **not verified current model prices**. If either rate is omitted, `estimatedCostUsd` is `null`. Estimates ignore any discounts, cached-input rates, taxes, or additional billable features; they are not invoices. See the [official pricing page](https://developers.openai.com/api/docs/pricing).

The resulting JSON shows `requestsMade`, `inputTokens`, `outputTokens`, `tokenUsageComplete`, optional `estimatedCostUsd`, and results for each fictional agent question. If token usage is missing from a response, cost estimation is disabled. The evaluator does not log API keys, response bodies, or full prompts. Live outputs can vary, and simple keyword checks are **not a comprehensive quality or safety benchmark**.

## Phase 7: authentication and audit history

**Required setup before `npm run dev`:** In GitHub → repository → Settings → Secrets and variables → Codespaces, create a secret named **`DASHBOARD_ADMIN_PASSWORD`** with a unique password of at least 12 characters. Grant this repository access and **restart the Codespace** so its environment receives the secret. Do not paste the password into chat, the terminal, or Git. The app intentionally refuses to start without it.

1. Run `npm test`, `npm run typecheck`, and `npm run build`.
2. Run `docker compose up -d db`, then `npm run dev`.
3. In Codespaces Ports, keep port **4000 Private** and open the forwarded `/dashboard` URL. You will be redirected to a branded sign-in page.
4. Sign in with the password you configured. The site uses an 8-hour server-side session and HttpOnly, SameSite=Strict cookie, plus per-session CSRF tokens for GraphQL writes.
5. Create and approve a *new fictional* replenishment proposal, then open **Activity log**. The approval decision should be recorded with actor `demo-admin` and timestamp.
6. The **AI Workspace** can record the role, number of tool calls, success/failure and duration for agent runs—but only if you explicitly invoke a potentially billable OpenAI call. Prompts, responses and API keys are not stored in the audit table.
7. Click **Sign out** and verify you cannot access the dashboard or GraphQL without signing in again.

The PostgreSQL `commerce_audit_events` table is initialized automatically for existing volumes. Approval status change and its audit entry share one transaction. Duplicate approval/rejection is still rejected.

**Limitations:** This implements **one demo-admin identity**, not real user accounts, RBAC, MFA, password reset, or persistent multi-instance sessions. The audit actor identifies the demo account, not a verified individual. Login throttling and sessions are held in one Node process and reset on restart; this is not production authentication. Keep the Codespace private and use fictional data only.

## Phase 6: CommerceOS dashboard and human approvals

The Node server now serves a responsive, professional operations dashboard at **`http://localhost:4000/dashboard`**, alongside GraphQL at `/graphql`. Use Codespaces **Ports → 4000 → Open in Browser** (port visibility must stay **Private**). You do **not** need to deploy a separate website or install a front-end build system.

The dashboard includes:

- Overview KPI cards for fictional orders, processing status, low stock and pending proposals.
- Inventory table with a **Create proposal** action available for products with 10 or fewer units.
- Human approval queue with Pending, Approved and Rejected filters.
- Optional AI Workspace. The **Run AI agent** button explicitly incurs live API usage; opening the site does not.
- Responsive layout for laptop and mobile.

**How to test the approval flow:**

1. Open the dashboard → Inventory.
2. Click **Create proposal** for Cotton T-shirt (8 in stock). The deterministic demo policy recommends 22 units to reach 30.
3. Open Approvals and click Approve or Reject.
4. Refresh: the decision is persisted in PostgreSQL. Neither button changes inventory or sends orders to suppliers.

The PostgreSQL approvals table and unique pending-SKU index are created automatically at server startup, including for existing Docker volumes. No database reset is necessary. Review transitions are atomic and one-way: a proposal cannot be approved and rejected twice. The same SKU can receive a fresh proposal after a previous one has been reviewed.

GraphQL API additions:

```graphql
query { approvalProposals { id sku status recommendedQuantity } }
mutation { recommendReplenishment(sku: "SHIRT-002") { id status recommendedQuantity } }
mutation { reviewApproval(id: "1", decision: APPROVED) { id status reviewedAt } }
```

**Security boundary:** Phase 6 originally had no authentication; Phase 7 now adds a single demo-admin password, session and CSRF protections. This remains a **private local/Codespaces portfolio prototype** without individual user accounts, role-based permissions, tenant isolation or verified human identities. **Do not make port 4000 public or use real business data.** Approval records a human decision in the demo only; it never places a purchase order. The inventory proposals are deterministic rules, not new autonomous LLM purchasing capabilities.

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

This is **not production-ready**: Phase 7 adds a single demo password and metadata-only audit history, but still lacks per-user authorization, MFA, distributed rate limits, verified audit identities, external messaging, and real purchase ordering. Keep your Codespaces port private. Do not use live customer information. All agents lack write tools. Do not commit API keys or `.env`.

## Suggested truthful portfolio description

After verifying tests and a live demo: *Built a prototype multi-agent e-commerce operations system with deterministic task routing, specialized LLM function calls, GraphQL/PostgreSQL integration, safety limits, automated tests, and a 14-scenario offline scripted evaluation harness.* Do not claim production deployment, real-model evaluation scores, or actual customer outcomes.
