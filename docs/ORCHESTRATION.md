# EurekaCore orchestration (Phase 1)

## Modules (`src/core/`)
| Module | Role |
|---|---|
| `permissions.ts` | Six autonomy tiers. Levels 5-6 are never covered by a grant; they need a recorded human approval. |
| `registry.ts` | `ProductRegistry`: validated product records (repo, API URL, auth, max level, health, docs). Seeds TINAN AI, Token Launchpad, Data Layer, Marketplace. |
| `audit.ts` | Append-only, hash-chained audit log; `verifyAuditChain` detects edits and deletions. |
| `workflow.ts` | `WorkflowEngine`: the 14-stage project pipeline, human gates, CAS persistence, retry, lease-based recovery, cancel. |
| `agent-stage.ts` | Adapts an `AgentProvider` (existing contract) to a proposal-only stage; agent gets no tools. |
| `src/server/d1.ts` | `D1WorkflowStore`, `D1AuditLog` (migration `0002_workflows_audit.sql`). |

## Guarantees (tested in `tests/orchestration.test.mjs`)
- A stage completes only when **every** acceptance criterion has exactly one passing result with evidence from the verifier, which is separate from the executor.
- A stage with no configured executor **blocks** the workflow; nothing is simulated or skipped.
- Gates (`plan-approval`, `deployment-approval`) need a named human and the exact review digest (hash of objective + all earlier outputs). Stale digests are refused. The level-5 `deployment` stage cannot run before its gate is approved, whatever level was granted.
- Linking a product caps the requested level at the product's `maxPermissionLevel`.
- Concurrent writers lose via version compare-and-set; a running stage holds a lease, `recover()` only revives stages whose lease expired; late results after cancel are discarded.
- Agent-proposed consequential actions stay text proposals; no approval is ever derived from agent output.

## What works vs. what does not
| Area | Status |
|---|---|
| Registry, tiers, audit chain, workflow engine, D1 stores | Implemented; tested in-memory and against SQLite (not real D1) |
| Planning stages with an `AgentProvider` | Works with any provider; tested only with the mock. Live TinanAi unverified |
| `security-review`, `preview`, `deployment*`, `monitoring` executors | **Not implemented** - the engine blocks at these stages |
| Queues / Durable Objects | Not used; `advance` runs a stage inside the request (25 s limit) |
| Shared AI provider layer (model routing, usage tracking), knowledge base | Not implemented; only the TinanAi provider exists |
| Launchpad / Data Layer / Marketplace integrations | Not implemented; registered as `not-integrated` |
| Solana wallet approvals | Not wired to the Worker API; approvals use Cloudflare Access identity |
| Remote Cloudflare D1, live GitHub, live TinanAi | **Not verified** (no credentials in the build environment) |

## Phase 2: authenticated execution engine
- **API** (`src/server/api.ts`, routed first by `cloudflare/worker.js`): `/api/session|products|integrations|workflows|approvals|audit` and `POST /api/workflows[/:id/advance|cancel|retry|recover|approve|reject]`.
- **Identity** (`src/server/auth.ts`): Cloudflare Access JWT verified server-side (RS256, JWKS, iss, aud, exp). Roles come from `EUREKA_VIEWERS/OPERATORS/APPROVERS`. Unconfigured -> 503 (closed). Approver identity is always the verified email; body identity is ignored. POSTs require same-origin `Origin`.
- **GitHub** (`src/server/github.ts`): allowlisted repos; writes only to non-default `eureka/*` branches; draft PRs only; no merge/delete/force methods.
- **Sandbox** (`src/server/sandbox.ts`, `src/sandbox/docker-runner.ts`, `scripts/sandbox-service.mjs`): the Worker never runs generated code; it calls a remote runner (Docker: no network, read-only, caps dropped, pids/memory/cpu limits, timeout kill). Only `node --test` is allowed.
- **Workflow `pr-delivery-v1`**: requirements -> architecture -> **plan-approval (human)** -> branch -> generation -> testing -> draft pull request. Every stage has a verifier that re-checks the real result (GitHub read-back, test exit code + a non-zero pass count, PR draft/open state). Missing configuration blocks the stage; nothing is simulated.
- **Control Center** reads only these authenticated routes and shows 401/403/503 honestly.

## Environment variable names
Names only: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `EUREKA_VIEWERS`, `EUREKA_OPERATORS`, `EUREKA_APPROVERS`, `GITHUB_TOKEN`, `GITHUB_ALLOWED_REPOS`, `SANDBOX_URL`, `SANDBOX_TOKEN`, `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`. D1 needs a `DB` binding with a real `database_id` (owner step, see `PERSISTENCE.md`); apply migrations `0001` and `0002`.

## Roadmap
1. **Phase 2 follow-ups:** live verification of D1/GitHub/TinanAi, security-review executor, Queues/DO for long stages, CI status inspection.
2. **Phase 3:** Launchpad / Data Layer / Marketplace contracts (see `ECOSYSTEM_INTEGRATIONS.md`).
3. **Phase 4:** deployment coordination, monitoring, knowledge retrieval.
