# Accurate resume and portfolio wording

**CommerceOS — Multi-Agent E-commerce Operations Platform (Portfolio Prototype)**  
*TypeScript · Node.js · GraphQL · PostgreSQL · OpenAI Responses API · JavaScript*

- Developed a TypeScript/GraphQL e-commerce operations prototype with **three specialized AI agents**, deterministic routing, validated read-only tool calls, and bounded execution.
- Built a PostgreSQL-backed approval workflow and responsive operations dashboard with a demo-admin login, CSRF protection, and audit metadata.
- Created a **14-scenario scripted evaluation harness** spanning routing, expected tool outputs and safety checks; recorded **14/14 passing scripted cases** and **3/3 fixed live-model fact checks**.

**Optional detailed portfolio metric:** A three-scenario `gpt-4.1-mini` evaluation used 6 API requests, 881 input tokens, 148 output tokens and averaged 2.07 seconds end-to-end. This is a small sample, not a production service-level claim.

## Thirty-second explanation

“I built CommerceOS to explore how to make AI agents useful without giving them unsafe permissions. Three specialized agents answer questions using read-only tools, while a separate human workflow reviews low-stock proposals. The project includes a GraphQL/PostgreSQL backend, protected dashboard, privacy-conscious audit log, deterministic tests and an opt-in live model evaluation runner.”

## Accuracy checklist

- Call it a **portfolio prototype**, not deployed production software.
- Do not claim real orders, customers, revenue, cost savings, or automated purchases.
- Replenishment suggestions come from a deterministic rule, not AI procurement.
- Approval records status and audit metadata; it doesn't trigger a purchase.
- A single demo-admin login is not enterprise identity management.
- **14/14 scripted** and **3/3 live** are observations of narrow tests, not 100% general model accuracy.
- Do not invent a final total test count unless you have the actual Codespaces output.

## STAR-style interview outline

**Situation:** Commerce support, fulfillment and inventory have different information needs, and autonomous tools can overstep.  
**Task:** Build an end-to-end, reviewable prototype with narrow agent permissions.  
**Action:** Implemented GraphQL services, PostgreSQL, three role-specific agents, tool validation, offline/live evaluation, a human approval queue and session controls.  
**Result:** Demonstrated passing scripted and limited live scenarios, persisted approval decisions and an auditable role-constrained workflow. This is technical evidence, not a production business outcome.
