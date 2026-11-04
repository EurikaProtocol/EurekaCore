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
| `generation`, `testing`, `security-review`, `preview`, `deployment*`, `monitoring` executors | **Not implemented** - the engine blocks at these stages |
| GitHub integration (branches, commits, PRs, CI) | **Not implemented** (Phase 2) |
| Sandboxed code execution | **Not implemented** (Phase 2) |
| Worker API + authentication for the engine; approver identity | **Not implemented**. `approve()` trusts the caller's host to have authenticated the human |
| Control Center (`/control-center`) | Static definitions only; no live data |
| Shared AI provider layer (model routing, retries, usage tracking) | Not implemented; only the existing TinanAi provider exists |
| Knowledge base, Launchpad/Data Layer/Marketplace integrations | Not implemented; registered as `not-integrated` |

## Environment variable names
No new variables. Existing: `TINANAI_BASE_URL`, `TINANAI_USERNAME`, `TINANAI_PASSWORD`. D1 needs a `DB` binding with a real `database_id` (owner step, see `PERSISTENCE.md`); apply migrations `0001` and `0002`.

## Roadmap
1. **Phase 2:** GitHub client (read, branch, commit, PR, CI status; never push to main/force-push/merge), sandboxed test runner, security-review and generation executors, Worker routes with an auth model.
2. **Phase 3:** TinanAi live verification, Launchpad / Data Layer / Marketplace contracts (see `ECOSYSTEM_INTEGRATIONS.md`).
3. **Phase 4:** deployment coordination, monitoring, knowledge retrieval, live Control Center.
